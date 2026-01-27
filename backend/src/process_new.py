from __future__ import annotations

import asyncio
import gc
import time
from collections.abc import AsyncIterator, Callable, Iterable, Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal

import navi
from api import (
    BaseInput,
    BaseOutput,
    BroadcastData,
    Collector,
    ExecutionOptions,
    Generator,
    InputId,
    IteratorOutputInfo,
    IterOutputId,
    Lazy,
    NodeContext,
    NodeData,
    NodeId,
    OutputId,
    SettingsParser,
    Transformer,
    registry,
)
from chain.cache import CacheStrategy, OutputCache, get_cache_strategies
from chain.chain import (
    Chain,
    CollectorNode,
    FunctionNode,
    GeneratorNode,
    Node,
    TransformerNode,
)
from events import EventConsumer, InputsDict, NodeBroadcastData
from logger import logger
from process_common import (
    CollectorOutput,
    ExecutionId,
    GeneratorOutput,
    NodeOutput,
    Output,
    RegularOutput,
    TransformerOutput,
)
from progress_controller import Aborted, ProgressController, ProgressToken
from util import timed_supplier


class CollectorNotReady(Exception):
    """Raised when a collector hasn't finished yet but a downstream node wants its value."""


class NodeExecutionError(Exception):
    """
    Raised when a node fails to run.

    Contains:
    - node_id: for identification
    - node_data: schema
    - cause: original message
    - inputs: best-effort input inspection
    """

    def __init__(
        self,
        node_id: NodeId,
        node_data: NodeData,
        cause: str,
        inputs: InputsDict,
    ):
        super().__init__(cause)
        self.node_id: NodeId = node_id
        self.node_data: NodeData = node_data
        self.inputs: InputsDict = inputs


# ======================================================================
# helpers
# ======================================================================
def collect_input_information(
    node: NodeData,
    inputs: list[object | Lazy[object]],
    enforced: bool = True,
) -> InputsDict:
    """
    Build a serializable view of the inputs for error reporting.

    If an input is still lazy, it is marked as {"type": "pending"}.
    If value enforcement fails and enforced=False, it is logged and the best-effort value is used.
    """
    try:
        input_dict: InputsDict = {}

        for value, node_input in zip(inputs, node.inputs, strict=False):
            if isinstance(value, Lazy) and value.has_value:
                processed_value = value.value
            else:
                processed_value = value

            if isinstance(processed_value, Lazy):
                input_dict[node_input.id] = {"type": "pending"}
                continue

            if not enforced:
                try:
                    processed_value = node_input.enforce_(processed_value)
                except Exception:
                    logger.exception(
                        "Error enforcing input %s (id %s) for node %s",
                        node_input.label,
                        node_input.id,
                        node.name,
                    )

            try:
                input_dict[node_input.id] = node_input.get_error_value(processed_value)
            except Exception:
                logger.exception(
                    "Error getting error value for input %s (id %s) on node %s",
                    node_input.label,
                    node_input.id,
                    node.name,
                )

        return input_dict
    except Exception:
        logger.exception("Error collecting input information for node %s.", node.name)
        return {}


def enforce_inputs(
    inputs: list[object],
    node: NodeData,
    node_id: NodeId,
    ignored_inputs: list[InputId],
) -> list[object]:
    """
    Enforce all inputs of a node.

    ignored_inputs: inputs that must stay lazy or get None (collectors' iterable inputs).
    """

    def enforce(i: BaseInput, value: object) -> object:
        if i.id in ignored_inputs:
            # keep shape, but value is ignored for run() call
            return None

        # we generally assume that enforcing a value is cheap, so we do it as soon as possible
        if i.lazy:
            if isinstance(value, Lazy):
                return Lazy(lambda: i.enforce_(value.value))
            return Lazy.ready(i.enforce_(value))

        if isinstance(value, Lazy):
            value = value.value  # compute lazy value
        return i.enforce_(value)

    try:
        enforced_inputs: list[object] = []
        for index, value in enumerate(inputs):
            enforced_inputs.append(enforce(node.inputs[index], value))
        return enforced_inputs
    except Exception as e:
        input_dict = collect_input_information(node, inputs, enforced=False)
        logger.exception("Error enforcing inputs for node %s (%s)", node.name, node_id)
        raise NodeExecutionError(node_id, node, str(e), input_dict) from e


def enforce_output(raw_output: object, node: NodeData) -> RegularOutput:
    """
    Normalize and enforce a function node's output according to its schema.

    - 0 outputs -> must return None
    - 1 output -> single value
    - N outputs -> iterable of length N
    """
    output_count = len(node.outputs)

    if output_count == 0:
        if raw_output is not None:
            raise RuntimeError(
                f"Node {node.name} declares 0 outputs but returned a value of type {type(raw_output).__name__}."
            )
        output: Output = []
    elif output_count == 1:
        output = [raw_output]
    else:
        if not isinstance(raw_output, tuple | list):
            raise TypeError(
                f"Node {node.name} declares {output_count} outputs but returned non-iterable {type(raw_output).__name__}."
            )
        output = list(raw_output)
        if len(output) != output_count:
            raise ValueError(
                f"Node {node.name} declares {output_count} outputs but returned {len(output)}."
            )

    # output-specific validations
    for i, o in enumerate(node.outputs):
        output[i] = o.enforce(output[i])

    return RegularOutput(output)


def enforce_generator_output(raw_output: object, node: NodeData) -> GeneratorOutput:
    """
    Normalize and enforce a generator node's output.

    Two valid shapes:
    1. generator only, when the node has exactly the iterable outputs
    2. (generator, *static_outputs) when the node has extra non-iterable outputs
    """
    output_count = len(node.outputs)
    generator_output = node.single_iterable_output
    partial: list[object] = [None] * output_count

    # case 1: number of node outputs equals the iterable ones
    if output_count == len(generator_output.outputs):
        if not isinstance(raw_output, Generator):
            raise TypeError(
                f"Generator node {node.name} was expected to return a Generator but returned {type(raw_output).__name__}."
            )
        return GeneratorOutput(
            info=generator_output,
            generator=raw_output,
            partial_output=partial,
        )

    # case 2: generator plus extra static outputs
    if output_count <= len(generator_output.outputs):
        raise RuntimeError(
            f"Generator node {node.name} has inconsistent output configuration."
        )

    if not isinstance(raw_output, tuple | list):
        raise TypeError(
            f"Generator node {node.name} was expected to return (Generator, ...) but returned {type(raw_output).__name__}."
        )

    iterator, *rest = raw_output
    if not isinstance(iterator, Generator):
        raise TypeError(
            f"Generator node {node.name} first element must be a Generator but got {type(iterator).__name__}."
        )
    if len(rest) != output_count - len(generator_output.outputs):
        raise ValueError(
            f"Generator node {node.name} expected {output_count - len(generator_output.outputs)} static outputs but got {len(rest)}."
        )

    for i, o in enumerate(node.outputs):
        if o.id not in generator_output.outputs:
            try:
                value = rest.pop(0)
            except IndexError as exc:
                raise RuntimeError(
                    f"Generator node {node.name} ran out of static outputs while enforcing."
                ) from exc
            partial[i] = o.enforce(value)

    return GeneratorOutput(
        info=generator_output,
        generator=iterator,
        partial_output=partial,
    )


def enforce_transformer_output(raw_output: object, node: NodeData) -> TransformerOutput:
    """
    Normalize and enforce a transformer node's output.

    Two valid shapes:
    1. transformer only, when the node has exactly the iterable outputs
    2. (transformer, *static_outputs) when the node has extra non-iterable outputs
    """
    output_count = len(node.outputs)
    transformer_output = node.single_iterable_output
    partial: list[object] = [None] * output_count

    # case 1: number of node outputs equals the iterable ones
    if output_count == len(transformer_output.outputs):
        if not isinstance(raw_output, Transformer):
            raise TypeError(
                f"Transformer node {node.name} was expected to return a Transformer but returned {type(raw_output).__name__}."
            )
        return TransformerOutput(
            info=transformer_output,
            transformer=raw_output,
            partial_output=partial,
        )

    # case 2: transformer plus extra static outputs
    if output_count <= len(transformer_output.outputs):
        raise RuntimeError(
            f"Transformer node {node.name} has inconsistent output configuration."
        )

    if not isinstance(raw_output, tuple | list):
        raise TypeError(
            f"Transformer node {node.name} was expected to return (Transformer, ...) but returned {type(raw_output).__name__}."
        )

    iterator, *rest = raw_output
    if not isinstance(iterator, Transformer):
        raise TypeError(
            f"Transformer node {node.name} first element must be a Transformer but got {type(iterator).__name__}."
        )
    if len(rest) != output_count - len(transformer_output.outputs):
        raise ValueError(
            f"Transformer node {node.name} expected {output_count - len(transformer_output.outputs)} static outputs but got {len(rest)}."
        )

    for i, o in enumerate(node.outputs):
        if o.id not in transformer_output.outputs:
            try:
                value = rest.pop(0)
            except IndexError as exc:
                raise RuntimeError(
                    f"Transformer node {node.name} ran out of static outputs while enforcing."
                ) from exc
            partial[i] = o.enforce(value)

    return TransformerOutput(
        info=transformer_output,
        transformer=iterator,
        partial_output=partial,
    )


def compute_broadcast(output: Output, node_outputs: Iterable[BaseOutput]):
    """
    Convert node outputs to broadcast payloads and types.
    """
    data: dict[OutputId, BroadcastData | None] = {}
    types: dict[OutputId, navi.ExpressionJson | None] = {}
    for index, node_output in enumerate(node_outputs):
        try:
            value = output[index]
            if value is not None:
                data[node_output.id] = node_output.get_broadcast_data(value)
                types[node_output.id] = node_output.get_broadcast_type(value)
        except Exception as e:
            logger.error(
                "Error broadcasting output %s (%s): %s",
                node_output.id,
                node_output.label,
                e,
            )
    return data, types


def compute_sequence_broadcast(
    generators: Iterable[Generator], node_iter_outputs: Iterable[IteratorOutputInfo]
):
    """
    Compute broadcast information for iterable outputs.
    """
    sequence_types: dict[IterOutputId, navi.ExpressionJson] = {}
    item_types: dict[OutputId, navi.ExpressionJson] = {}
    for g, iter_output in zip(generators, node_iter_outputs, strict=False):
        try:
            sequence_types[iter_output.id] = iter_output.get_broadcast_sequence_type(g)
            for output_id, type_ in iter_output.get_broadcast_item_types(g).items():
                item_types[output_id] = type_
        except Exception as e:
            logger.error(
                "Error broadcasting iterable output %s: %s",
                iter_output.id,
                e,
            )
    return sequence_types, item_types


# ======================================================================
# timers
# ======================================================================
class _IterationTimer:
    """
    Measure time between iterations while accounting for pauses.
    """

    def __init__(self, progress: ProgressController) -> None:
        self.times: list[float] = []
        self.progress = progress
        self._start_time = time.monotonic()
        self._start_paused = progress.time_paused
        self._last_time = self._start_time
        self._last_paused = self._start_paused

    @property
    def iterations(self) -> int:
        return len(self.times)

    def get_time_since_start(self) -> float:
        now = time.monotonic()
        paused = self.progress.time_paused
        current_paused = max(0, paused - self._start_paused)
        return now - self._start_time - current_paused

    def add(self) -> None:
        now = time.monotonic()
        paused = self.progress.time_paused
        current_paused = max(0, paused - self._last_paused)
        self.times.append(now - self._last_time - current_paused)
        self._last_time = now
        self._last_paused = paused


# ======================================================================
# NodeContext
# ======================================================================
class _ExecutorNodeContext(NodeContext):
    """
    NodeContext used during executor runtime.

    Holds:
    - progress token (abort, pause)
    - package settings
    - per-node and per-chain cleanup sets
    """

    def __init__(
        self, progress: ProgressToken, settings: SettingsParser, storage_dir: Path
    ) -> None:
        super().__init__()
        self.progress = progress
        self._settings = settings
        self._storage_dir = storage_dir
        self.chain_cleanup_fns: set[Callable[[], None]] = set()
        self.node_cleanup_fns: set[Callable[[], None]] = set()

    @property
    def aborted(self) -> bool:
        return self.progress.aborted

    @property
    def paused(self) -> bool:
        # Python is single-threaded, so it's necessary for this thread to yield, so other threads can do some work.
        # This is necessary because the thread for accepting the `/pause` endpoint would not be able to accept requests otherwise.
        # This in turn would mean that `self.progress.paused` would never be set to True.
        # For more information, see https://github.com/chaiNNer-org/chaiNNer/pull/2853
        time.sleep(0)
        return self.progress.paused

    def set_progress(self, progress: float) -> None:
        # we emit progress via executor events instead
        self.check_aborted()

        # TODO: send progress event

    @property
    def settings(self) -> SettingsParser:
        return self._settings

    @property
    def storage_dir(self) -> Path:
        return self._storage_dir

    def add_cleanup(
        self, fn: Callable[[], None], after: Literal["node", "chain"] = "chain"
    ) -> None:
        if after == "chain":
            self.chain_cleanup_fns.add(fn)
        else:
            assert after == "node", "after must be 'node' or 'chain'"
            self.node_cleanup_fns.add(fn)


# ======================================================================
# Runtime nodes
# ======================================================================
class RuntimeNode(AsyncIterator[Output]):
    def __init__(self, node: Node, executor: Executor, iterative: bool):
        self.node = node
        self.executor = executor
        self.iterative = iterative
        self._started = False
        self._finished = False
        self._iter_timer = _IterationTimer(executor.progress)
        # None means "no meaningful expected length", 0 means "expected length is 0"
        self._expected_len: int | None = None
        # For generators/transformers: tracks actual items produced (vs iterations with fanout)
        # For other nodes: None means use _iter_timer.iterations instead
        self._items_produced: int | None = None
        # Accumulated execution time for this node's own work (not upstream)
        self._accumulated_exec_time: float = 0.0

    def _ensure_started(self) -> None:
        if not self._started:
            self.executor.send_node_start(self.node)
            self._started = True

    def _send_progress(self) -> None:
        # only broadcast progress if we actually know the length
        if self._expected_len is None:
            return
        # Use _items_produced if available (generators/transformers), otherwise iterations
        idx = (
            self._items_produced
            if self._items_produced is not None
            else self._iter_timer.iterations
        )
        total = self._expected_len
        self.executor.send_node_progress(self.node, self._iter_timer.times, idx, total)

    def _finish(self) -> None:
        if not self._finished:
            # only send progress-done if we sent progress at all
            if self._expected_len is not None:
                # Use _items_produced if available (generators/transformers), otherwise iterations
                idx = (
                    self._items_produced
                    if self._items_produced is not None
                    else self._iter_timer.iterations
                )
                self.executor.send_node_progress_done(
                    self.node, idx, self._expected_len
                )
            self.executor.send_node_finish(self.node, self._accumulated_exec_time)
            self._finished = True

    async def __anext__(self) -> Output:
        raise NotImplementedError


class StaticRuntimeNode(RuntimeNode):
    def __init__(
        self, node: FunctionNode, executor: Executor, fanout: int, iterative: bool
    ):
        super().__init__(node, executor, iterative)
        self.fanout = fanout
        self._current_served = 0
        self._current_value: Output | None = None
        self._ran_on_final_collectors = False

    async def __anext__(self) -> Output:
        self._ensure_started()
        if self._finished:
            raise StopAsyncIteration

        # leaf fed only by final collectors? only run once
        if self.executor.raw_downstream_counts[self.node.id] == 0:
            if (
                self.executor.all_inputs_from_final_collectors(self.node)
                and self._ran_on_final_collectors
            ):
                self._finish()
                raise StopAsyncIteration

        if self._current_value is None:
            # Check cache before computing
            cached_result: NodeOutput | None = None
            strategy = self.executor.cache_strategy.get(self.node.id)

            if not self.iterative:
                # First check parent_cache (cross-execution persistence)
                if self.executor.node_cache.parent is not None:
                    cached_result = self.executor.node_cache.parent.get(self.node.id)

                # Then check current execution cache
                if cached_result is None:
                    cached_result = self.executor.node_cache.get(self.node.id)

            # Use cached result if available and valid
            if cached_result is not None and isinstance(cached_result, RegularOutput):
                self._current_value = cached_result.output
            else:
                # Compute fresh result
                inputs = await self.executor.runtime_inputs_for_async(self.node)
                ctx = self.executor.get_node_context(self.node)
                raw, exec_time = await self.executor.run_node_async(
                    self.node, ctx, inputs
                )
                self._accumulated_exec_time += exec_time
                if not isinstance(raw, RegularOutput):
                    raise RuntimeError(
                        f"StaticRuntimeNode for {self.node.id} "
                        f"expected RegularOutput but received "
                        f"{type(raw).__name__}."
                    )
                self.executor.send_node_broadcast(self.node, raw.output)
                self._current_value = raw.output

                # Store in cache if caching is enabled
                if strategy is not None and not strategy.no_caching:
                    self.executor.node_cache.set(self.node.id, raw, strategy)

            # mark that we have run once on finalized collectors
            if self.executor.all_inputs_from_final_collectors(self.node):
                self._ran_on_final_collectors = True

        out = self._current_value
        self._current_served += 1
        self._iter_timer.add()
        self._send_progress()

        if self._current_served >= self.fanout:
            self._current_value = None
            self._current_served = 0
            if not self.iterative:
                self._finish()
            elif self.executor.raw_downstream_counts[
                self.node.id
            ] == 0 and self.executor.all_inputs_from_final_collectors(self.node):
                self._finish()

        return out


class GeneratorRuntimeNode(RuntimeNode):
    def __init__(
        self,
        node: GeneratorNode,
        executor: Executor,
        fanout: int,
    ):
        super().__init__(node, executor, iterative=True)
        self.fanout = fanout
        self._current_served = 0
        self._current_value: Output | None = None
        self._gen_iter: Iterator | None = None
        self._partial: Output | None = None
        self._items_produced = 0

    # ---------- helpers ----------

    def _has_truly_iterative_parent(self) -> bool:
        """
        Return True iff at least one upstream can actually produce
        more than one item over time.

        We count as "truly iterative":
          - upstream is a GeneratorNode
          - upstream is a CollectorNode whose runtime is iterative
        Everything else (static function, chain input) is not enough to
        justify reinitializing this generator forever.
        """
        for inp in self.node.data.inputs:
            edge = self.executor.chain.edge_to(self.node.id, inp.id)
            if edge is None:
                # chain input -> static
                continue
            src_id = edge.source.id
            src_node = self.executor.chain.nodes[src_id]

            if isinstance(src_node, GeneratorNode):
                return True

            if isinstance(src_node, TransformerNode):
                return True

            if isinstance(src_node, CollectorNode):
                rt = self.executor.runtimes[src_id]
                if isinstance(rt, CollectorRuntimeNode) and rt.iterative:
                    return True

            # NOTE: we deliberately do NOT treat regular FunctionNode
            # as "truly iterative" here, because only a generator, transformer, or an
            # iterative collector can keep feeding us forever. A function
            # may be iterative indirectly (because *it* pulls from a generator),
            # but in that case runtime_inputs_for(...) below will succeed again,
            # so we will re-init anyway.
        return False

    async def _init_new_inner(self) -> bool:
        """
        Pull fresh inputs and create a new inner iterator.

        This is called when the current generator iterator is exhausted and we
        need to create a new one from fresh upstream inputs. If we have a truly
        iterative parent, this allows the generator to restart with new data.

        Returns:
            True  -> new inner iterator created successfully
            False -> upstream exhausted, no more data available
        """
        try:
            inputs = await self.executor.runtime_inputs_for_async(self.node)
        except CollectorNotReady:
            # Bubble up to executor loop - it will drive the collector to completion
            raise
        except StopAsyncIteration:
            # Real upstream exhaustion - no more data available
            return False

        ctx = self.executor.get_node_context(self.node)
        out, exec_time = await self.executor.run_node_async(self.node, ctx, inputs)
        self._accumulated_exec_time += exec_time
        assert isinstance(out, GeneratorOutput)

        self._partial = out.partial_output
        # Create iterator from the generator's supplier function
        self._gen_iter = out.generator.supplier().__iter__()
        self._expected_len = out.generator.expected_length
        self._items_produced = 0
        return True

    # ---------- main logic ----------

    async def _advance(self) -> Output:
        """
        Get one item for this generator.

        This method handles the complexity of generator iteration:
        - Creates a new inner iterator if needed
        - Handles iterator exhaustion by checking if we should restart
        - Returns a properly formatted output with partial outputs combined

        If the current inner iterator is exhausted:
          - if we have a truly iterative parent, re-init and continue
          - else, finish (no more items available)
        """
        while True:
            if self._gen_iter is None:
                ok = await self._init_new_inner()
                if not ok:
                    # Upstream can't give us more data -> we're done
                    self._finish()
                    raise StopAsyncIteration

            assert self._gen_iter is not None
            try:
                iter_start = time.monotonic()
                values = next(self._gen_iter)
                self._accumulated_exec_time += time.monotonic() - iter_start
            except StopIteration:
                # Inner iterator exhausted - need to decide whether to restart
                self._gen_iter = None
                self._partial = None
                # Don't reset _items_produced before _finish() -
                # it needs the count for final progress
                # Reset will happen in _init_new_inner() if we re-init

                # Check if we should re-init or stop
                # Only re-init if we have a truly iterative parent that can feed us more
                if not self._has_truly_iterative_parent():
                    self._finish()
                    raise StopAsyncIteration from None

                # Loop around to try building a new inner iterator
                continue

            # Successfully got a value from current inner iterator
            break

        # Increment items produced counter when we successfully get an item
        assert self._items_produced is not None
        self._items_produced += 1

        assert self._partial is not None
        iterable_output = self.node.data.single_iterable_output
        if len(iterable_output.outputs) == 1:
            seq_vals = [values]
        else:
            assert isinstance(values, tuple | list)
            seq_vals = list(values)

        full_out = self._partial.copy()
        for idx, o in enumerate(self.node.data.outputs):
            if o.id in iterable_output.outputs:
                full_out[idx] = o.enforce(seq_vals.pop(0))

        self.executor.send_node_broadcast(self.node, full_out)
        return full_out

    async def __anext__(self) -> Output:
        self._ensure_started()
        if self._finished:
            raise StopAsyncIteration

        if self._current_value is None:
            self._current_value = await self._advance()
            self._current_served = 0

        out = self._current_value
        self._current_served += 1
        self._iter_timer.add()
        self._send_progress()

        if self._current_served >= self.fanout:
            self._current_value = None
            self._current_served = 0

        return out


class CollectorRuntimeNode(RuntimeNode):
    def __init__(
        self,
        node: CollectorNode,
        executor: Executor,
        inner: Collector | None,
        iterative: bool,
        has_downstream: bool,
        fanout: int,
    ):
        super().__init__(node, executor, iterative)
        self._collector = inner
        self._final_output: Output | None = None
        self.has_downstream = has_downstream

    def is_done(self) -> bool:
        return self._final_output is not None

    def final_output(self) -> Output:
        if self._final_output is None:
            raise RuntimeError(
                f"CollectorRuntimeNode for {self.node.id} was asked for final output but is not done."
            )
        return self._final_output

    def _set_final(self, value: Output) -> None:
        self._final_output = value
        # broadcast once
        self.executor.send_node_broadcast(self.node, value)

    async def __anext__(self) -> Output:
        self._ensure_started()

        # if we are already finalized as a root, we stop iterating
        if self._final_output is not None:
            # root loop: we made progress once already, now stop
            self._finish()
            raise StopAsyncIteration

        if self._finished:
            raise StopAsyncIteration

        iterable_input = self.node.data.single_iterable_input
        iterable_ids = set(iterable_input.inputs)

        # ---------- non-iterative collector ----------
        # Non-iterative collectors finalize immediately after processing input
        if not self.iterative:
            try:
                # Try to get iterable inputs - if this fails, we finalize immediately
                _ = await self.executor.runtime_inputs_for_async(
                    self.node, only_ids=iterable_ids
                )
            except StopAsyncIteration as err:
                # No iterable inputs available - finalize immediately with empty collection
                all_inputs = await self.executor.runtime_inputs_for_async(self.node)
                ctx = self.executor.get_node_context(self.node)
                raw, exec_time = await self.executor.run_node_async(
                    self.node, ctx, all_inputs
                )
                self._accumulated_exec_time += exec_time
                if not isinstance(raw, CollectorOutput):
                    raise RuntimeError(
                        f"Collector node {self.node.id} was expected to return CollectorOutput but got {type(raw).__name__}."
                    ) from err
                self._collector = raw.collector
                complete_start = time.monotonic()
                final = self._collector.on_complete()
                self._accumulated_exec_time += time.monotonic() - complete_start
                enforced = enforce_output(final, self.node.data)
                self._set_final(enforced.output)
                self._iter_timer.add()
                self._send_progress()
                # Return once so the root loop sees progress
                return enforced.output

            # There was at least one iterable item - initialize collector if needed
            if self._collector is None:
                all_inputs = await self.executor.runtime_inputs_for_async(self.node)
                ctx = self.executor.get_node_context(self.node)
                raw, exec_time = await self.executor.run_node_async(
                    self.node, ctx, all_inputs
                )
                self._accumulated_exec_time += exec_time
                if not isinstance(raw, CollectorOutput):
                    raise RuntimeError(
                        f"Collector node {self.node.id} was expected to return CollectorOutput but got {type(raw).__name__}."
                    )
                self._collector = raw.collector

            # consume exactly one item
            enforced_inputs: list[object] = []
            for inp in self.node.data.inputs:
                if inp.id in iterable_ids:
                    enforced_inputs.append(
                        inp.enforce_(
                            (
                                await self.executor.runtime_inputs_for_async(
                                    self.node, only_ids={inp.id}
                                )
                            )[0]
                        )
                    )
            iter_arg = (
                enforced_inputs[0]
                if len(enforced_inputs) == 1
                else tuple(enforced_inputs)
            )
            iterate_start = time.monotonic()
            self._collector.on_iterate(iter_arg)
            self._accumulated_exec_time += time.monotonic() - iterate_start

            # complete right away for non-iterative
            complete_start = time.monotonic()
            final = self._collector.on_complete()
            self._accumulated_exec_time += time.monotonic() - complete_start
            enforced = enforce_output(final, self.node.data)
            self._set_final(enforced.output)
            self._iter_timer.add()
            self._send_progress()
            return enforced.output

        # ---------- iterative collector ----------
        # Iterative collectors accumulate items over multiple iterations
        try:
            iter_values = await self.executor.runtime_inputs_for_async(
                self.node, only_ids=iterable_ids
            )
        except StopAsyncIteration as err:
            # Upstream exhausted -> time to finalize the collection
            if self._collector is None:
                # Create collector from non-iterable inputs only
                # (iterable inputs are exhausted, so we use None for those)
                non_iter_ids = {
                    inp.id
                    for inp in self.node.data.inputs
                    if inp.id not in iterable_ids
                }
                if non_iter_ids:
                    non_iter_vals = await self.executor.runtime_inputs_for_async(
                        self.node, only_ids=non_iter_ids
                    )
                else:
                    non_iter_vals = []
                full_inputs: list[object] = []
                non_it = iter(non_iter_vals)
                for inp in self.node.data.inputs:
                    if inp.id in iterable_ids:
                        full_inputs.append(None)  # Exhausted iterable input
                    else:
                        full_inputs.append(next(non_it, None))
                ctx = self.executor.get_node_context(self.node)
                raw, exec_time = await self.executor.run_node_async(
                    self.node, ctx, full_inputs
                )
                self._accumulated_exec_time += exec_time
                if not isinstance(raw, CollectorOutput):
                    raise RuntimeError(
                        f"Collector node {self.node.id} was expected to return CollectorOutput but got {type(raw).__name__}."
                    ) from err
                self._collector = raw.collector

            # Finalize and return the collected result
            complete_start = time.monotonic()
            final = self._collector.on_complete()
            self._accumulated_exec_time += time.monotonic() - complete_start
            enforced = enforce_output(final, self.node.data)
            self._set_final(enforced.output)
            self._iter_timer.add()
            self._send_progress()
            return enforced.output

        # Ensure collector exists - initialize it if this is the first iteration
        if self._collector is None:
            non_iter_ids = {
                inp.id for inp in self.node.data.inputs if inp.id not in iterable_ids
            }
            if non_iter_ids:
                non_iter_vals = await self.executor.runtime_inputs_for_async(
                    self.node, only_ids=non_iter_ids
                )
            else:
                non_iter_vals = []
            init_inputs: list[object] = []
            it_iter = iter(iter_values)
            it_non = iter(non_iter_vals)
            for inp in self.node.data.inputs:
                if inp.id in iterable_ids:
                    init_inputs.append(next(it_iter))
                else:
                    init_inputs.append(next(it_non, None))
            ctx = self.executor.get_node_context(self.node)
            raw, exec_time = await self.executor.run_node_async(
                self.node, ctx, init_inputs
            )
            self._accumulated_exec_time += exec_time
            if not isinstance(raw, CollectorOutput):
                raise RuntimeError(
                    f"Collector node {self.node.id} was expected to return CollectorOutput but got {type(raw).__name__}."
                )
            self._collector = raw.collector

        # Perform one incremental iteration: collect the current item(s)
        iter_enforced_inputs: list[object] = []
        it_vals = iter(iter_values)
        for inp in self.node.data.inputs:
            if inp.id in iterable_ids:
                iter_enforced_inputs.append(inp.enforce_(next(it_vals)))
        # Collector expects single item or tuple of items depending on schema
        iter_arg = (
            iter_enforced_inputs[0]
            if len(iter_enforced_inputs) == 1
            else tuple(iter_enforced_inputs)
        )
        iterate_start = time.monotonic()
        self._collector.on_iterate(iter_arg)
        self._accumulated_exec_time += time.monotonic() - iterate_start

        self._iter_timer.add()
        self._send_progress()
        # Return empty output - the final result will be returned when finalized
        return []


class TransformerRuntimeNode(RuntimeNode):
    def __init__(
        self,
        node: TransformerNode,
        executor: Executor,
        fanout: int,
    ):
        super().__init__(node, executor, iterative=True)
        self.fanout = fanout
        self._current_served = 0
        self._current_value: Output | None = None
        self._transformer: Transformer[object, object] | None = None
        self._supplier_iter: Iterator[object] | None = None
        self._partial: Output | None = None
        self._items_produced = 0

    # ---------- helpers ----------

    def _has_truly_iterative_parent(self) -> bool:
        """
        Return True iff at least one upstream can actually produce
        more than one item over time.

        We count as "truly iterative":
          - upstream is a GeneratorNode
          - upstream is a TransformerNode
          - upstream is a CollectorNode whose runtime is iterative
        Everything else (static function, chain input) is not enough to
        justify reinitializing this transformer forever.
        """
        iterable_input = self.node.data.single_iterable_input
        iterable_ids = set(iterable_input.inputs)

        for inp_id in iterable_ids:
            edge = self.executor.chain.edge_to(self.node.id, inp_id)
            if edge is None:
                # chain input -> static
                continue
            src_id = edge.source.id
            src_node = self.executor.chain.nodes[src_id]

            if isinstance(src_node, GeneratorNode):
                return True

            if isinstance(src_node, TransformerNode):
                return True

            if isinstance(src_node, CollectorNode):
                rt = self.executor.runtimes[src_id]
                if isinstance(rt, CollectorRuntimeNode) and rt.iterative:
                    return True

            # NOTE: we deliberately do NOT treat regular FunctionNode
            # as "truly iterative" here, because only a generator, transformer, or an
            # iterative collector can keep feeding us forever. A function
            # may be iterative indirectly (because *it* pulls from a generator),
            # but in that case runtime_inputs_for(...) below will succeed again,
            # so we will re-init anyway.
        return False

    async def _init_new_inner(self) -> bool:
        """
        Collect all upstream items into lists, pass to node function, call supplier() once.

        This method sets up the transformer for a new iteration cycle:
        1. Collects ALL upstream items into lists (one list per iterable input)
        2. Passes lists to node function (not None)
        3. Calls supplier() once to get output iterator

        Returns:
            True  -> new supplier iterator created successfully
            False -> upstream exhausted or configuration invalid, no more data
        """
        iterable_input = self.node.data.single_iterable_input
        iterable_ids = list(iterable_input.inputs)

        if not iterable_ids:
            return False

        # Collect ALL upstream items into lists (one list per iterable input)
        collected_lists: dict[InputId, list[object]] = {
            inp_id: [] for inp_id in iterable_ids
        }

        while True:
            try:
                items = await self.executor.runtime_inputs_for_async(
                    self.node, only_ids=set(iterable_ids)
                )
                for inp_id, item in zip(iterable_ids, items, strict=False):
                    collected_lists[inp_id].append(item)
            except StopAsyncIteration:
                break

        # If no items were collected, upstream was already exhausted
        if all(len(lst) == 0 for lst in collected_lists.values()):
            return False

        # Get non-iterable inputs if any
        non_iter_ids = {
            inp.id for inp in self.node.data.inputs if inp.id not in iterable_ids
        }
        if non_iter_ids:
            try:
                non_iter_vals = await self.executor.runtime_inputs_for_async(
                    self.node, only_ids=non_iter_ids
                )
            except StopAsyncIteration:
                non_iter_vals = []
        else:
            non_iter_vals = []

        # Build full_inputs: pass lists for iterable inputs, values for non-iterable
        full_inputs: list[object] = []
        it_non = iter(non_iter_vals)
        iterable_ids_set = set(iterable_ids)
        for inp in self.node.data.inputs:
            if inp.id in iterable_ids_set:
                # Pass the collected list for this iterable input
                full_inputs.append(collected_lists[inp.id])
            else:
                full_inputs.append(next(it_non, None))

        ctx = self.executor.get_node_context(self.node)
        out, exec_time = await self.executor.run_node_async(self.node, ctx, full_inputs)
        self._accumulated_exec_time += exec_time
        assert isinstance(out, TransformerOutput)

        self._partial = out.partial_output
        self._transformer = out.transformer
        # Call supplier() once to get the output iterator
        self._supplier_iter = iter(out.transformer.supplier())
        self._items_produced = 0
        self._expected_len = out.transformer.expected_length
        return True

    # ---------- main logic ----------

    async def _advance(self) -> Output:
        """
        Get one output item for this transformer.

        The supplier has already captured the input sequence(s) via closure
        and yields output items. We simply iterate through the supplier's output.

        If the supplier is exhausted:
          - if we have a truly iterative parent, re-init and continue
          - else, finish (no more data available)
        """
        while True:
            if self._supplier_iter is None:
                ok = await self._init_new_inner()
                if not ok:
                    # Upstream can't give us more data -> we're done
                    self._finish()
                    raise StopAsyncIteration

            assert self._supplier_iter is not None

            try:
                iter_start = time.monotonic()
                values = next(self._supplier_iter)
                self._accumulated_exec_time += time.monotonic() - iter_start
                # Successfully got a value from supplier
                assert self._items_produced is not None
                self._items_produced += 1
                break
            except StopIteration:
                # Supplier exhausted - clean up and check if we should re-init
                self._transformer = None
                self._supplier_iter = None
                self._partial = None
                # Don't reset _items_produced before _finish() -
                # it needs the count for final progress

                # Check if we should re-init or stop
                # Only re-init if we have a truly iterative parent that can feed us more
                if not self._has_truly_iterative_parent():
                    self._finish()
                    raise StopAsyncIteration from None

                # Reset items produced for next iteration cycle
                self._items_produced = 0
                # Loop around to try building a new supplier iterator
                continue

        assert self._partial is not None
        iterable_output = self.node.data.single_iterable_output
        if len(iterable_output.outputs) == 1:
            seq_vals = [values]
        else:
            assert isinstance(values, tuple | list)
            seq_vals = list(values)

        full_out = self._partial.copy()
        for idx, o in enumerate(self.node.data.outputs):
            if o.id in iterable_output.outputs:
                full_out[idx] = o.enforce(seq_vals.pop(0))

        self.executor.send_node_broadcast(self.node, full_out)
        return full_out

    async def __anext__(self) -> Output:
        self._ensure_started()
        if self._finished:
            raise StopAsyncIteration

        if self._current_value is None:
            self._current_value = await self._advance()
            self._current_served = 0

        out = self._current_value
        self._current_served += 1
        self._iter_timer.add()
        self._send_progress()

        if self._current_served >= self.fanout:
            self._current_value = None
            self._current_served = 0

        return out


class SideEffectLeafRuntimeNode(RuntimeNode):
    def __init__(
        self,
        node: FunctionNode,
        executor: Executor,
        iterative: bool,
    ):
        super().__init__(node, executor, iterative)
        # to avoid running twice on same final collector inputs
        self._ran_on_final_collectors = False

    async def __anext__(self) -> Output:
        self._ensure_started()
        if self._finished:
            raise StopAsyncIteration

        # if all parents are final collectors and we already ran once, stop
        if (
            self.executor.all_inputs_from_final_collectors(self.node)
            and self._ran_on_final_collectors
        ):
            self._finish()
            raise StopAsyncIteration

        # pull inputs bottom-up
        try:
            inputs = await self.executor.runtime_inputs_for_async(self.node)
        except CollectorNotReady:
            # collectors not ready yet
            raise
        except StopAsyncIteration:
            # real upstream exhaustion
            self._finish()
            raise

        # run node
        ctx = self.executor.get_node_context(self.node)
        out, exec_time = await self.executor.run_node_async(self.node, ctx, inputs)
        self._accumulated_exec_time += exec_time

        if isinstance(out, RegularOutput):
            self.executor.send_node_broadcast(self.node, out.output)

        self._iter_timer.add()
        self._send_progress()

        # if all parents are final collectors, mark and finish next time
        if self.executor.all_inputs_from_final_collectors(self.node):
            self._ran_on_final_collectors = True

        # if this leaf was not supposed to be iterative, end right now
        if not self.iterative:
            self._finish()

        return out.output if isinstance(out, RegularOutput) else []


# ======================================================================
# Executor
# ======================================================================
class Executor:
    def __init__(
        self,
        id: ExecutionId,
        chain: Chain,
        send_broadcast_data: bool,
        options: ExecutionOptions,
        loop: asyncio.AbstractEventLoop,
        queue: EventConsumer,
        pool: ThreadPoolExecutor,
        storage_dir: Path,
        parent_cache: OutputCache[NodeOutput] | None = None,
    ):
        self.id = id
        self.chain = chain
        self.send_broadcast_data = send_broadcast_data
        self.options = options
        self.loop = loop
        self.queue = queue
        self.pool = pool
        self.progress = ProgressController()
        self.node_cache: OutputCache[NodeOutput] = OutputCache(parent=parent_cache)
        self.cache_strategy: dict[NodeId, CacheStrategy] = get_cache_strategies(chain)
        self._storage_dir = storage_dir
        self.__context_cache: dict[str, _ExecutorNodeContext] = {}
        self.__broadcast_tasks: list[asyncio.Task[None]] = []

        (
            self.raw_downstream_counts,
            self._downstream_counts,
        ) = self._compute_downstream_counts()
        self._iterative_nodes = self._compute_iterative_nodes()
        self.runtimes: dict[NodeId, RuntimeNode] = {}
        self._build_runtimes()

    # ------------------------------------------------------------------
    # pause/resume/kill control
    # ------------------------------------------------------------------
    def pause(self) -> None:
        """Pause the current execution."""
        self.progress.pause()

    def resume(self) -> None:
        """Resume the current execution."""
        self.progress.resume()

    def kill(self) -> None:
        """Kill (abort) the current execution."""
        self.progress.abort()

    # ------------------------------------------------------------------
    # downstream counts
    # ------------------------------------------------------------------
    def _compute_downstream_counts(self) -> tuple[dict[NodeId, int], dict[NodeId, int]]:
        raw: dict[NodeId, int] = dict.fromkeys(self.chain.nodes, 0)
        for nid in self.chain.nodes:
            for _e in self.chain.edges_from(nid):
                raw[nid] += 1
        # fanout counts used by runtime to serve downstreams
        fanout: dict[NodeId, int] = {}
        for nid, c in raw.items():
            fanout[nid] = c if c > 0 else 1
        return raw, fanout

    # ------------------------------------------------------------------
    # mark nodes that belong to a generator-driven lineage
    # ------------------------------------------------------------------
    def _compute_iterative_nodes(self) -> set[NodeId]:
        """
        Mark every node that is in an iterator lineage.

        1. Start from all generator nodes and transformer nodes.
        2. Go downstream following iterator outputs.
        3. Go upstream to make parents iterative too.
        """
        iterative: set[NodeId] = set()

        # 1) seed: all generators and transformers
        gen_ids = [
            n.id for n in self.chain.nodes.values() if isinstance(n, GeneratorNode)
        ]
        trans_ids = [
            n.id for n in self.chain.nodes.values() if isinstance(n, TransformerNode)
        ]

        def _mark_downstream_from_iterator(seed_id: NodeId) -> None:
            """Mark all downstream nodes that follow iterator outputs from a seed node."""
            stack = [seed_id]
            while stack:
                nid = stack.pop()
                if nid in iterative:
                    continue
                iterative.add(nid)
                # Check if this node is a collector - collectors break iterator lineage
                current_node = self.chain.nodes[nid]
                if isinstance(current_node, CollectorNode):
                    # Don't follow edges from collectors - they produce final outputs
                    continue
                for edge in self.chain.edges_from(nid):
                    src_node = self.chain.nodes[edge.source.id]
                    # Only follow iterator outputs from generators and transformers
                    if isinstance(src_node, (GeneratorNode, TransformerNode)):
                        if (
                            edge.source.output_id
                            not in src_node.data.single_iterable_output.outputs
                        ):
                            continue
                    stack.append(edge.target.id)

        # 2) downstream from each generator (only iterator outputs from generators)
        for gid in gen_ids:
            _mark_downstream_from_iterator(gid)

        # 2b) downstream from each transformer (only iterator outputs from transformers)
        for tid in trans_ids:
            _mark_downstream_from_iterator(tid)

        # 3) upstream closure
        changed = True
        while changed:
            changed = False
            for node_id, _node in self.chain.nodes.items():
                if node_id in iterative:
                    continue
                feeds_iterative = any(
                    e.target.id in iterative for e in self.chain.edges_from(node_id)
                )
                if feeds_iterative:
                    iterative.add(node_id)
                    changed = True

        return iterative

    # ------------------------------------------------------------------
    # build runtimes
    # ------------------------------------------------------------------
    def _build_runtimes(self) -> None:
        for node in self.chain.nodes.values():
            fanout = self._downstream_counts[node.id]
            iterative = node.id in self._iterative_nodes
            is_leaf = self.raw_downstream_counts[node.id] == 0

            if isinstance(node, GeneratorNode):
                self.runtimes[node.id] = GeneratorRuntimeNode(node, self, fanout)
            elif isinstance(node, CollectorNode):
                has_downstream = self.raw_downstream_counts[node.id] > 0
                self.runtimes[node.id] = CollectorRuntimeNode(
                    node,
                    self,
                    inner=None,
                    iterative=iterative,
                    has_downstream=has_downstream,
                    fanout=fanout,
                )
            elif isinstance(node, TransformerNode):
                self.runtimes[node.id] = TransformerRuntimeNode(node, self, fanout)
            else:
                # node must be FunctionNode after checking other types
                assert isinstance(node, FunctionNode), "Expected FunctionNode"
                if is_leaf and node.has_side_effects():
                    self.runtimes[node.id] = SideEffectLeafRuntimeNode(
                        node, self, iterative=iterative
                    )
                else:
                    self.runtimes[node.id] = StaticRuntimeNode(
                        node, self, fanout, iterative=iterative
                    )

    # ------------------------------------------------------------------
    # input resolution
    # ------------------------------------------------------------------
    async def runtime_inputs_for_async(
        self, node: Node, only_ids: set[InputId] | None = None
    ) -> list[object]:
        """Async version of runtime_inputs_for that awaits upstream RuntimeNodes."""
        values: list[object] = []
        for node_input in node.data.inputs:
            if only_ids is not None and node_input.id not in only_ids:
                continue

            edge = self.chain.edge_to(node.id, node_input.id)
            if edge is not None:
                src_id = edge.source.id
                output_id = edge.source.output_id
                src_node = self.chain.nodes[src_id]

                try:
                    src_index = next(
                        i
                        for i, o in enumerate(src_node.data.outputs)
                        if o.id == output_id
                    )
                except StopIteration as exc:
                    raise ValueError(
                        f"Output id {output_id} not found in source node {src_id}"
                    ) from exc

                upstream_rt = self.runtimes[src_id]

                if isinstance(upstream_rt, CollectorRuntimeNode):
                    if not upstream_rt.is_done():
                        raise CollectorNotReady
                    out = upstream_rt.final_output()
                    if src_index >= len(out):
                        raise StopAsyncIteration
                    values.append(out[src_index])
                    continue

                try:
                    out = await upstream_rt.__anext__()
                except StopAsyncIteration:
                    raise

                if src_index >= len(out):
                    raise StopAsyncIteration
                values.append(out[src_index])
            else:
                v = self.chain.inputs.get(node.id, node_input.id)
                if v is None:
                    if node_input.optional:
                        values.append(None)
                    else:
                        raise ValueError(
                            f"Required input '{node_input.label}' (id {node_input.id}) on node {node.id} has no edge and no provided value."
                        )
                else:
                    values.append(v)
        return values

    # ------------------------------------------------------------------
    # async node run
    # ------------------------------------------------------------------
    async def run_node_async(
        self, node: Node, context: _ExecutorNodeContext, inputs: list[object]
    ) -> tuple[NodeOutput | CollectorOutput | TransformerOutput, float]:
        """Run a node asynchronously in the thread pool. Returns (output, execution_time)."""
        if node.data.kind == "collector":
            ignored = node.data.single_iterable_input.inputs
        else:
            # Transformers now receive lists for iterable inputs, so don't ignore them
            ignored = []

        enforced_inputs = enforce_inputs(inputs, node.data, node.id, ignored)

        def execute_node() -> NodeOutput | CollectorOutput | TransformerOutput:
            try:
                if node.data.node_context:
                    raw = node.data.run(context, *enforced_inputs)
                else:
                    raw = node.data.run(*enforced_inputs)

                if node.data.kind == "collector":
                    if not isinstance(raw, Collector):
                        raise RuntimeError(
                            f"Collector node {node.id} returned {type(raw).__name__} instead of Collector."
                        )
                    return CollectorOutput(raw)
                if node.data.kind == "generator":
                    return enforce_generator_output(raw, node.data)
                if node.data.kind == "transformer":
                    return enforce_transformer_output(raw, node.data)
                return enforce_output(raw, node.data)
            except Exception as e:
                info = collect_input_information(node.data, enforced_inputs)
                logger.exception("Error running node %s (%s)", node.data.name, node.id)
                raise NodeExecutionError(node.id, node.data, str(e), info) from e

        return await self.loop.run_in_executor(self.pool, timed_supplier(execute_node))

    def get_node_context(self, node: Node) -> _ExecutorNodeContext:
        ctx = self.__context_cache.get(node.schema_id)
        if ctx is None:
            pkg = registry.get_package(node.schema_id)
            settings = self.options.get_package_settings(pkg.id)
            ctx = _ExecutorNodeContext(self.progress, settings, self._storage_dir)
            self.__context_cache[node.schema_id] = ctx
        return ctx

    # ------------------------------------------------------------------
    # run
    # ------------------------------------------------------------------
    async def run(self) -> None:
        logger.debug("Running executor %s", self.id)
        self._send_chain_start()
        try:
            await self._run_collectors_bottom_up()
        finally:
            gc.collect()

    def _identify_lineages(self) -> list[set[NodeId]]:
        """
        Group nodes into connected components (lineages) based on edges.

        Returns a list of sets, where each set contains the node IDs
        in one lineage. Nodes that are connected through edges belong
        to the same lineage.
        """
        visited: set[NodeId] = set()
        lineages: list[set[NodeId]] = []

        def dfs(node_id: NodeId, lineage: set[NodeId]) -> None:
            """Depth-first search to find all connected nodes."""
            if node_id in visited:
                return
            visited.add(node_id)
            lineage.add(node_id)

            # Follow edges in both directions (upstream and downstream)
            # Downstream: nodes that this node feeds into
            for edge in self.chain.edges_from(node_id):
                dfs(edge.target.id, lineage)
            # Upstream: nodes that feed into this node
            for edge in self.chain.edges_to(node_id):
                dfs(edge.source.id, lineage)

        # Find all connected components
        for node_id in self.chain.nodes.keys():
            if node_id not in visited:
                lineage: set[NodeId] = set()
                dfs(node_id, lineage)
                lineages.append(lineage)

        return lineages

    async def _run_lineage_to_completion(self, lineage_nodes: set[NodeId]) -> None:
        """
        Run a single lineage to completion.

        Identifies root nodes within the lineage and runs them in
        round-robin until the entire lineage is exhausted.

        Args:
            lineage_nodes: Set of node IDs belonging to this lineage
        """
        roots: list[RuntimeNode] = []

        # Identify root nodes within this lineage
        for rt in self.runtimes.values():
            node_id = rt.node.id
            # Only consider nodes that belong to this lineage
            if node_id not in lineage_nodes:
                continue

            is_leaf = self.raw_downstream_counts[node_id] == 0

            if isinstance(rt, CollectorRuntimeNode):
                roots.append(rt)
                continue

            if isinstance(rt, SideEffectLeafRuntimeNode):
                roots.append(rt)
                continue

            if is_leaf:
                roots.append(rt)

        # Round-robin execution loop for this lineage
        while True:
            # Check for abort state - exit early if killed
            if self.progress.aborted:
                break

            # Wait for resume if paused
            # (will raise Aborted if killed while paused)
            try:
                await self.progress.suspend()
            except Aborted:
                # Execution was killed, exit loop
                break

            any_progress = False
            for rt in roots:
                try:
                    _ = await rt.__anext__()
                    any_progress = True
                except CollectorNotReady:
                    # Upstream collector not done yet - skip for now,
                    # try again next iteration
                    pass
                except StopAsyncIteration:
                    # This root is exhausted - it will naturally
                    # stop being called
                    pass
            # Yield to event loop to allow other tasks to run
            # (pauses, aborts, etc.)
            await asyncio.sleep(0)
            if not any_progress:
                # No root made progress this round - lineage is done
                break

    async def _run_collectors_bottom_up(self) -> None:
        """
        Run each unconnected lineage to completion sequentially.

        This is the main execution loop. It identifies all connected
        components (lineages) in the chain and runs each one to completion
        before moving to the next. This ensures that lineages don't depend
        on each other and can complete independently.

        Each lineage runs its roots in a round-robin fashion until
        exhausted. Roots include:
        - collectors (which need to be driven to completion)
        - leaf side-effect nodes (nodes with side effects and no outputs)
        - leaf static nodes (regular function nodes with no downstream)
        """
        # Identify all connected components (lineages)
        lineages = self._identify_lineages()

        # Run each lineage to completion sequentially
        for lineage_nodes in lineages:
            # Check for abort state between lineages
            if self.progress.aborted:
                break

            # Run this lineage to completion
            await self._run_lineage_to_completion(lineage_nodes)

            # Check for abort state after lineage completion
            if self.progress.aborted:
                break

        await self._finalize_chain()

    async def _finalize_chain(self) -> None:
        # 1) force-finish every runtime that was started but not finished
        for rt in self.runtimes.values():
            if rt._started and not rt._finished:  # noqa: SLF001
                rt._finish()  # noqa: SLF001

        # 2) run chain-level cleanups
        for ctx in self.__context_cache.values():
            for fn in ctx.chain_cleanup_fns:
                try:
                    fn()
                except Exception as e:
                    logger.error("Error running cleanup function: %s", e)

        # 3) wait for all outstanding broadcasts
        tasks = self.__broadcast_tasks
        self.__broadcast_tasks = []
        for t in tasks:
            await t

    # ------------------------------------------------------------------
    # events
    # ------------------------------------------------------------------
    def _send_chain_start(self) -> None:
        nodes: list[str] = [str(nid) for nid in self.chain.nodes.keys()]
        self.queue.put({"event": "chain-start", "data": {"nodes": nodes}})

    def send_node_start(self, node: Node) -> None:
        self.queue.put({"event": "node-start", "data": {"nodeId": node.id}})

    def send_node_progress(
        self, node: Node, times: list[float], index: int, length: int
    ) -> None:
        def get_eta(ts: list[float]) -> float:
            if not ts:
                return 0.0
            ts = ts[-100:]
            weights = [max(1 / i, 0.9**i) for i in range(len(ts), 0, -1)]
            avg = sum(t * w for t, w in zip(ts, weights, strict=False)) / sum(weights)
            remaining = max(0, length - index)
            return avg * remaining

        self.queue.put(
            {
                "event": "node-progress",
                "data": {
                    "nodeId": node.id,
                    "progress": 1 if length == 0 else index / max(1, length),
                    "index": index,
                    "total": length,
                    "eta": get_eta(times),
                },
            }
        )

    def send_node_progress_done(self, node: Node, index: int, total: int) -> None:
        self.queue.put(
            {
                "event": "node-progress",
                "data": {
                    "nodeId": node.id,
                    "progress": 1,
                    "index": index,
                    "total": total,
                    "eta": 0,
                },
            }
        )

    def send_node_broadcast(
        self,
        node: Node,
        output: Output,
        generators: Iterable[Generator] | None = None,
    ) -> None:
        if not self.send_broadcast_data or not node.data.outputs:
            return

        def compute_bcast():
            if self.progress.aborted:
                return None
            data, types = compute_broadcast(output, node.data.outputs)
            if generators is None:
                return (data, types, {}, {})
            seq_types, item_types = compute_sequence_broadcast(
                generators, node.data.iterable_outputs
            )
            for oid, t in item_types.items():
                types[oid] = t
            return (data, types, seq_types, item_types)

        async def send():
            result = await self.loop.run_in_executor(self.pool, compute_bcast)
            if result is None or self.progress.aborted:
                return
            data, types, seq_types, _ = result
            ev: NodeBroadcastData = {
                "nodeId": node.id,
                "data": data,
                "types": types,
                "sequenceTypes": seq_types,
            }
            self.queue.put({"event": "node-broadcast", "data": ev})

        self.__broadcast_tasks.append(self.loop.create_task(send()))

    def send_node_finish(self, node: Node, execution_time: float) -> None:
        self.queue.put(
            {
                "event": "node-finish",
                "data": {"nodeId": node.id, "executionTime": execution_time},
            }
        )

    def all_inputs_from_final_collectors(self, node: Node) -> bool:
        for node_input in node.data.inputs:
            edge = self.chain.edge_to(node.id, node_input.id)
            if edge is None:
                return False
            upstream_rt = self.runtimes[edge.source.id]
            if not (
                isinstance(upstream_rt, CollectorRuntimeNode) and upstream_rt.is_done()
            ):
                return False
        return True

    async def run_individual_node(self, node: Node) -> Output | None:
        """
        Run a single node individually.

        Assumes the executor's chain already contains the node and its inputs are set.
        Handles both generator and regular node execution paths.

        Returns:
            Output | None: The output for regular nodes, None for generators.
        """
        # Send chain-start because we are not calling executor.run()
        self._send_chain_start()

        node_data = node.data
        if node_data.kind == "generator":
            # For generators, only initialize to get Generator object
            # and type info. Do NOT iterate through outputs.
            self.send_node_start(node)

            # Get inputs and run node to get GeneratorOutput
            inputs = await self.runtime_inputs_for_async(node)
            node_ctx = self.get_node_context(node)
            gen_output, exec_time = await self.run_node_async(node, node_ctx, inputs)
            if not isinstance(gen_output, GeneratorOutput):
                raise RuntimeError(f"Generator node {node.id} expected GeneratorOutput")

            # Send broadcast with partial outputs and Generator
            # for type info
            self.send_node_broadcast(
                node,
                gen_output.partial_output,
                generators=[gen_output.generator],
            )

            # Send node-finish event with actual execution time (not including input fetching)
            self.send_node_finish(node, exec_time)

            # Finalize chain so broadcasts and cleanups finish
            await self._finalize_chain()
            return None  # Generators are not cached
        else:
            # Runtime nodes are built in executor.__init__
            runtime = self.runtimes[node.id]

            # Manually iterate regular node runtime
            # Get the first output, then drain any remaining iterations
            last: Output | None = None
            try:
                out = await runtime.__anext__()
                last = out
            except StopAsyncIteration:
                last = None
            # Some function nodes may be iterative; drain remaining
            # iterations
            while True:
                try:
                    _ = await runtime.__anext__()
                except StopAsyncIteration:
                    break
            await self._finalize_chain()
            return last
