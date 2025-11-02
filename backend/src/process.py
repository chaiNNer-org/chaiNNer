from __future__ import annotations

import asyncio
import gc
import time
from collections.abc import Callable, Iterable, Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, NewType

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
    registry,
)
from chain.cache import (
    CacheStrategy,
    OutputCache,
    get_cache_strategies,
)
from chain.chain import (
    Chain,
    CollectorNode,
    FunctionNode,
    GeneratorNode,
    Node,
)
from events import EventConsumer, InputsDict, NodeBroadcastData
from logger import logger
from progress_controller import ProgressController, ProgressToken

Output = list[object]
ExecutionId = NewType("ExecutionId", str)


# ======================================================================
# helpers
# ======================================================================
def collect_input_information(
    node: NodeData,
    inputs: list[object | Lazy[object]],
    enforced: bool = True,
) -> InputsDict:
    try:
        input_dict: InputsDict = {}

        for value, node_input in zip(inputs, node.inputs, strict=False):
            if isinstance(value, Lazy) and value.has_value:
                value = value.value

            if isinstance(value, Lazy):
                input_dict[node_input.id] = {"type": "pending"}
                continue

            if not enforced:
                try:
                    value = node_input.enforce_(value)
                except Exception:
                    logger.exception(
                        "Error enforcing input %s (id %s)",
                        node_input.label,
                        node_input.id,
                    )

            try:
                input_dict[node_input.id] = node_input.get_error_value(value)
            except Exception:
                logger.exception(
                    "Error getting error value for input %s (id %s)",
                    node_input.label,
                    node_input.id,
                )

        return input_dict
    except Exception:
        logger.exception("Error collecting input information.")
        return {}


def enforce_inputs(
    inputs: list[object],
    node: NodeData,
    node_id: NodeId,
    ignored_inputs: list[InputId],
) -> list[object]:
    def enforce(i: BaseInput, value: object) -> object:
        if i.id in ignored_inputs:
            return None

        if i.lazy:
            if isinstance(value, Lazy):
                return Lazy(lambda: i.enforce_(value.value))
            return Lazy.ready(i.enforce_(value))

        if isinstance(value, Lazy):
            value = value.value
        return i.enforce_(value)

    try:
        enforced_inputs: list[object] = []
        for index, value in enumerate(inputs):
            enforced_inputs.append(enforce(node.inputs[index], value))
        return enforced_inputs
    except Exception as e:
        input_dict = collect_input_information(node, inputs, enforced=False)
        raise NodeExecutionError(node_id, node, str(e), input_dict) from e


def enforce_output(raw_output: object, node: NodeData) -> RegularOutput:
    l = len(node.outputs)

    if l == 0:
        assert raw_output is None, f"Expected all {node.name} nodes to return None."
        output: Output = []
    elif l == 1:
        output = [raw_output]
    else:
        assert isinstance(raw_output, (tuple, list))
        output = list(raw_output)
        assert (
            len(output) == l
        ), f"Expected all {node.name} nodes to have {l} output(s) but found {len(output)}."

    for i, o in enumerate(node.outputs):
        output[i] = o.enforce(output[i])

    return RegularOutput(output)


def enforce_generator_output(raw_output: object, node: NodeData) -> GeneratorOutput:
    l = len(node.outputs)
    generator_output = node.single_iterable_output

    partial: list[object] = [None] * l

    if l == len(generator_output.outputs):
        assert isinstance(raw_output, Generator)
        return GeneratorOutput(
            info=generator_output,
            generator=raw_output,
            partial_output=partial,
        )

    assert l > len(generator_output.outputs)
    assert isinstance(raw_output, (tuple, list))

    iterator, *rest = raw_output
    assert isinstance(iterator, Generator)
    assert len(rest) == l - len(generator_output.outputs)

    for i, o in enumerate(node.outputs):
        if o.id not in generator_output.outputs:
            partial[i] = o.enforce(rest.pop(0))

    return GeneratorOutput(
        info=generator_output,
        generator=iterator,
        partial_output=partial,
    )


def compute_broadcast(output: Output, node_outputs: Iterable[BaseOutput]):
    data: dict[OutputId, BroadcastData | None] = {}
    types: dict[OutputId, navi.ExpressionJson | None] = {}
    for index, node_output in enumerate(node_outputs):
        try:
            value = output[index]
            if value is not None:
                data[node_output.id] = node_output.get_broadcast_data(value)
                types[node_output.id] = node_output.get_broadcast_type(value)
        except Exception as e:
            logger.error("Error broadcasting output: %s", e)
    return data, types


def compute_sequence_broadcast(
    generators: Iterable[Generator], node_iter_outputs: Iterable[IteratorOutputInfo]
):
    sequence_types: dict[IterOutputId, navi.ExpressionJson] = {}
    item_types: dict[OutputId, navi.ExpressionJson] = {}
    for g, iter_output in zip(generators, node_iter_outputs, strict=False):
        try:
            sequence_types[iter_output.id] = iter_output.get_broadcast_sequence_type(g)
            for output_id, type in iter_output.get_broadcast_item_types(g).items():
                item_types[output_id] = type
        except Exception as e:
            logger.error("Error broadcasting output: %s", e)
    return sequence_types, item_types


class NodeExecutionError(Exception):
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


@dataclass(frozen=True)
class RegularOutput:
    output: Output


@dataclass(frozen=True)
class GeneratorOutput:
    info: IteratorOutputInfo
    generator: Generator
    partial_output: Output


@dataclass(frozen=True)
class CollectorOutput:
    collector: Collector


NodeOutput = RegularOutput | GeneratorOutput


# ======================================================================
# timers
# ======================================================================
class _IterationTimer:
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

    def add(self):
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
        time.sleep(0)
        return self.progress.paused

    def set_progress(self, progress: float) -> None:
        # we emit progress via executor events instead
        self.check_aborted()

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
            self.node_cleanup_fns.add(fn)


# ======================================================================
# Runtime nodes
# ======================================================================
class RuntimeNode(Iterator[Output]):
    def __init__(self, node: Node, executor: Executor, iterative: bool):
        self.node = node
        self.executor = executor
        self.iterative = iterative
        self._started = False
        self._finished = False
        self._iter_timer = _IterationTimer(executor.progress)
        self._expected_len = 0

    def _ensure_started(self):
        if not self._started:
            self.executor._send_node_start(self.node)
            self._started = True

    def _send_progress(self):
        idx = self._iter_timer.iterations
        total = self._expected_len if self._expected_len else idx
        self.executor._send_node_progress(self.node, self._iter_timer.times, idx, total)

    def _finish(self):
        if not self._finished:
            self.executor._send_node_progress_done(
                self.node, self._iter_timer.iterations
            )
            self.executor._send_node_finish(
                self.node, self._iter_timer.get_time_since_start()
            )
            self._finished = True

    def __next__(self) -> Output:
        raise NotImplementedError


class StaticRuntimeNode(RuntimeNode):
    def __init__(
        self,
        node: FunctionNode,
        executor: Executor,
        fanout: int,
        iterative: bool,
    ):
        super().__init__(node, executor, iterative)
        self.fanout = fanout
        self._current_served = 0
        self._current_value: Output | None = None

    def _compute_once(self) -> Output:
        inputs = self.executor.runtime_inputs_for(self.node)
        ctx = self.executor._get_node_context(self.node)
        raw = self.executor._run_node_immediate(self.node, ctx, inputs)
        assert isinstance(raw, RegularOutput)
        self.executor._send_node_broadcast(self.node, raw.output)
        return raw.output

    def __next__(self) -> Output:
        self._ensure_started()
        if self._finished:
            raise StopIteration

        if self._current_value is None:
            self._current_value = self._compute_once()
            self._current_served = 0

        out = self._current_value
        self._current_served += 1
        self._iter_timer.add()
        self._send_progress()

        if self._current_served >= self.fanout:
            # served all downstreams for this iteration
            self._current_value = None
            self._current_served = 0
            if not self.iterative:
                # static-lineage: done after first round
                self._finish()

        return out


class GeneratorRuntimeNode(RuntimeNode):
    def __init__(
        self,
        node: GeneratorNode,
        executor: Executor,
        fanout: int,
    ):
        super().__init__(node, executor, iterative=True)  # always iterative
        self.fanout = fanout
        self._current_served = 0
        self._current_value: Output | None = None
        self._gen_iter: Iterator | None = None
        self._partial: Output | None = None

    def _ensure_iter(self):
        if self._gen_iter is not None:
            return
        inputs = self.executor.runtime_inputs_for(self.node)
        ctx = self.executor._get_node_context(self.node)
        out = self.executor._run_node_immediate(self.node, ctx, inputs)
        assert isinstance(out, GeneratorOutput)
        self._partial = out.partial_output
        self._gen_iter = out.generator.supplier().__iter__()
        self._expected_len = out.generator.expected_length or 0

    def _advance(self) -> Output:
        self._ensure_iter()
        assert self._gen_iter is not None
        try:
            values = next(self._gen_iter)
        except StopIteration:
            self._finish()
            raise

        assert self._partial is not None
        iterable_output = self.node.data.single_iterable_output
        if len(iterable_output.outputs) == 1:
            seq_vals = [values]
        else:
            assert isinstance(values, (tuple, list))
            seq_vals = list(values)

        full_out = self._partial.copy()
        for idx, o in enumerate(self.node.data.outputs):
            if o.id in iterable_output.outputs:
                full_out[idx] = o.enforce(seq_vals.pop(0))

        self.executor._send_node_broadcast(self.node, full_out)
        return full_out

    def __next__(self) -> Output:
        self._ensure_started()
        if self._finished:
            raise StopIteration

        if self._current_value is None:
            self._current_value = self._advance()
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
        fanout: int,
    ):
        super().__init__(node, executor, iterative)
        self._collector = inner
        self._fanout = fanout
        self._serving_final = False
        self._final_output: Output | None = None
        self._served_final = 0

    def __next__(self) -> Output:
        self._ensure_started()

        # if we're in "serving final value" mode, just hand it out
        if self._serving_final:
            if self._served_final >= self._fanout:
                self._finish()
                raise StopIteration
            assert self._final_output is not None
            self._served_final += 1
            self._iter_timer.add()
            self._send_progress()
            return self._final_output

        if self._finished:
            raise StopIteration

        iterable_input = self.node.data.single_iterable_input

        # 1) try to pull next item(s) for on_iterate
        try:
            iter_values = self.executor.runtime_inputs_for(
                self.node, only_ids=set(iterable_input.inputs)
            )
        except StopIteration:
            # upstream is exhausted -> finalize collector
            self._finalize_and_switch_to_serving()
            # now we are in serving mode; serve first copy
            return self.__next__()

        # 2) if we don't have a collector object yet, create it
        if self._collector is None:
            all_inputs = self.executor.runtime_inputs_for(self.node)
            ctx = self.executor._get_node_context(self.node)
            raw = self.executor._run_node_immediate(self.node, ctx, all_inputs)
            assert isinstance(raw, CollectorOutput)
            self._collector = raw.collector

        # 3) enforce the iterable inputs we just pulled
        enforced_inputs: list[object] = []
        for inp in self.node.data.inputs:
            if inp.id in iterable_input.inputs:
                enforced_inputs.append(inp.enforce_(iter_values.pop(0)))
        iter_arg = (
            enforced_inputs[0] if len(enforced_inputs) == 1 else tuple(enforced_inputs)
        )

        # 4) run on_iterate
        try:
            self._collector.on_iterate(iter_arg)
        except StopIteration:
            # collector wants to stop now -> finalize and serve final
            self._finalize_and_switch_to_serving()
            return self.__next__()

        # 5) iterative collectors keep going; static ones finalize right away
        self._iter_timer.add()
        self._send_progress()

        if not self.iterative:
            # static-lineage: run once → finalize → serve final to downstream
            self._finalize_and_switch_to_serving()
            return self.__next__()

        # iterative: nothing to return to downstream at this iteration
        return []

    def _finalize_and_switch_to_serving(self):
        if self._serving_final:
            return

        final_raw = None
        if self._collector is not None:
            final_raw = self._collector.on_complete()

        # collectors declare outputs in the schema, so enforce
        enforced = enforce_output(final_raw, self.node.data)
        self.executor._send_node_broadcast(self.node, enforced.output)

        # now we will serve this value to every downstream consumer
        self._final_output = enforced.output
        self._serving_final = True
        self._served_final = 0


class SideEffectLeafRuntimeNode(RuntimeNode):
    def __init__(
        self,
        node: FunctionNode,
        executor: Executor,
        iterative: bool,
    ):
        super().__init__(node, executor, iterative)

    def __next__(self) -> Output:
        self._ensure_started()
        if self._finished:
            raise StopIteration

        # pull inputs bottom-up
        try:
            inputs = self.executor.runtime_inputs_for(self.node)
        except StopIteration:
            # upstream is done
            self._finish()
            raise

        # run node
        ctx = self.executor._get_node_context(self.node)
        out = self.executor._run_node_immediate(self.node, ctx, inputs)

        # <-- this was missing
        if isinstance(out, RegularOutput):
            # side-effect node usually has at least 1 output to broadcast to frontend
            self.executor._send_node_broadcast(self.node, out.output)

        # progress
        self._iter_timer.add()
        self._send_progress()

        # static-lineage: run once
        if not self.iterative:
            self._finish()

        # return the (possibly empty) output so downstream can still read
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
            self._raw_downstream_counts,
            self._downstream_counts,
        ) = self._compute_downstream_counts()
        self._iterative_nodes = self._compute_iterative_nodes()
        self._runtimes: dict[NodeId, RuntimeNode] = {}
        self._build_runtimes()

    # ------------------------------------------------------------------
    # downstream counts
    # ------------------------------------------------------------------
    def _compute_downstream_counts(self) -> tuple[dict[NodeId, int], dict[NodeId, int]]:
        raw: dict[NodeId, int] = {nid: 0 for nid in self.chain.nodes}
        for nid in self.chain.nodes:
            for e in self.chain.edges_from(nid):
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

        1. Start from all generator nodes.
        2. Go **downstream** following iterator outputs -> everything you reach is iterative.
        3. Then go **upstream**: if an iterative node has an input coming from X, then X must
        also be iterative (otherwise the iterative node couldn't keep pulling).
        4. Repeat upstream propagation until stable.
        """
        iterative: set[NodeId] = set()

        # 1) seed: all generators
        gen_ids = [
            n.id for n in self.chain.nodes.values() if isinstance(n, GeneratorNode)
        ]

        # 2) downstream from each generator (only iterator outputs from generators)
        for gid in gen_ids:
            stack = [gid]
            while stack:
                nid = stack.pop()
                if nid in iterative:
                    continue
                iterative.add(nid)
                for edge in self.chain.edges_from(nid):
                    src_node = self.chain.nodes[edge.source.id]
                    if isinstance(src_node, GeneratorNode):
                        # only follow the iterable outputs
                        if (
                            edge.source.output_id
                            not in src_node.data.single_iterable_output.outputs
                        ):
                            continue
                    stack.append(edge.target.id)

        # 3) upstream closure:
        # keep adding parents of iterative nodes until no new ones appear
        changed = True
        while changed:
            changed = False
            for node_id, node in self.chain.nodes.items():
                if node_id in iterative:
                    continue
                # check: does this node feed any iterative node?
                feeds_iterative = False
                for e in self.chain.edges_from(node_id):
                    if e.target.id in iterative:
                        feeds_iterative = True
                        break
                if feeds_iterative:
                    iterative.add(node_id)
                    changed = True

        return iterative

    # ------------------------------------------------------------------
    # build runtimes
    # ------------------------------------------------------------------
    def _build_runtimes(self):
        for node in self.chain.nodes.values():
            fanout = self._downstream_counts[node.id]
            iterative = node.id in self._iterative_nodes
            is_leaf = self._raw_downstream_counts[node.id] == 0

            if isinstance(node, GeneratorNode):
                self._runtimes[node.id] = GeneratorRuntimeNode(node, self, fanout)
            elif isinstance(node, CollectorNode):
                fanout = self._downstream_counts[node.id]
                self._runtimes[node.id] = CollectorRuntimeNode(
                    node,
                    self,
                    inner=None,
                    iterative=iterative,
                    fanout=fanout,
                )
            elif isinstance(node, FunctionNode):
                if is_leaf and node.has_side_effects():
                    # leaf side-effect -> behave like collector
                    self._runtimes[node.id] = SideEffectLeafRuntimeNode(
                        node, self, iterative=iterative
                    )
                else:
                    # regular function node (incl. side-effect non-leaf)
                    self._runtimes[node.id] = StaticRuntimeNode(
                        node, self, fanout, iterative=iterative
                    )
            else:
                raise ValueError("Unknown node type")

    # ------------------------------------------------------------------
    # input resolution
    # ------------------------------------------------------------------
    def runtime_inputs_for(
        self, node: Node, only_ids: set[InputId] | None = None
    ) -> list[object]:
        values: list[object] = []

        for node_input in node.data.inputs:
            # skip inputs we're not currently resolving (collectors do this)
            if only_ids is not None and node_input.id not in only_ids:
                continue

            edge = self.chain.edge_to(node.id, node_input.id)
            if edge is not None:
                # pull from upstream
                src_id = edge.source.id
                output_id = edge.source.output_id
                src_node = self.chain.nodes[src_id]

                # find output index on source node
                try:
                    src_index = next(
                        i
                        for i, o in enumerate(src_node.data.outputs)
                        if o.id == output_id
                    )
                except StopIteration:
                    raise ValueError(
                        f"Output id {output_id} not found on source node {src_id}"
                    )

                upstream_rt = self._runtimes[src_id]
                out = next(upstream_rt)

                # if the source didn't produce that output this iteration,
                # treat it as source exhaustion and bubble up
                if src_index >= len(out):
                    raise StopIteration

                values.append(out[src_index])
            else:
                # no edge: try chain-provided literal / UI value
                v = self.chain.inputs.get(node.id, node_input.id)

                if v is None:
                    if node_input.optional:
                        values.append(None)
                        continue
                    # required input is missing -> this is a chain definition error
                    raise ValueError(
                        f"Required input '{node_input.label}' (id {node_input.id}) on node {node.id} has no edge and no provided value."
                    )

                values.append(v)

        return values

    # ------------------------------------------------------------------
    # immediate node run
    # ------------------------------------------------------------------
    def _run_node_immediate(
        self, node: Node, context: _ExecutorNodeContext, inputs: list[object]
    ) -> NodeOutput | CollectorOutput:
        if node.data.kind == "collector":
            ignored = node.data.single_iterable_input.inputs
        else:
            ignored = []
        enforced_inputs = enforce_inputs(inputs, node.data, node.id, ignored)
        try:
            if node.data.node_context:
                raw = node.data.run(context, *enforced_inputs)
            else:
                raw = node.data.run(*enforced_inputs)
            if node.data.kind == "collector":
                assert isinstance(raw, Collector)
                return CollectorOutput(raw)
            if node.data.kind == "generator":
                return enforce_generator_output(raw, node.data)
            return enforce_output(raw, node.data)
        except Exception as e:
            info = collect_input_information(node.data, enforced_inputs)
            raise NodeExecutionError(node.id, node.data, str(e), info) from e

    def _get_node_context(self, node: Node) -> _ExecutorNodeContext:
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
    async def run(self):
        logger.debug("Running executor %s", self.id)
        self._send_chain_start()
        try:
            await self._run_collectors_bottom_up()
        finally:
            gc.collect()

    async def _run_collectors_bottom_up(self):
        # roots = things the executor must drive itself
        roots: list[RuntimeNode] = []
        for rt in self._runtimes.values():
            n = rt.node

            # 1) real collectors
            if isinstance(rt, CollectorRuntimeNode):
                roots.append(rt)
                continue

            # 2) leaf side-effect nodes (we wrapped these as SideEffectLeafRuntimeNode)
            if isinstance(rt, SideEffectLeafRuntimeNode):
                # these really are leaves, we detected that in _build_runtimes
                roots.append(rt)
                continue

            # 3) everything else: DO NOT add here
            #    non-leaf side-effect nodes will be pulled by their downstream
            #    nodes (e.g. generators) and will therefore stop when those
            #    downstream nodes stop.

        # now run until none of the roots can make progress
        while True:
            any_progress = False
            for rt in roots:
                try:
                    _ = next(rt)
                    any_progress = True
                except StopIteration:
                    pass
            await asyncio.sleep(0)
            if not any_progress:
                break

        await self._finalize_chain()

    async def _finalize_chain(self):
        for ctx in self.__context_cache.values():
            for fn in ctx.chain_cleanup_fns:
                try:
                    fn()
                except Exception as e:
                    logger.error("Error running cleanup function: %s", e)

        tasks = self.__broadcast_tasks
        self.__broadcast_tasks = []
        for t in tasks:
            await t

    # ------------------------------------------------------------------
    # events
    # ------------------------------------------------------------------
    def _send_chain_start(self):
        nodes = list(self.chain.nodes.keys())
        self.queue.put({"event": "chain-start", "data": {"nodes": nodes}})

    def _send_node_start(self, node: Node):
        self.queue.put({"event": "node-start", "data": {"nodeId": node.id}})

    def _send_node_progress(
        self, node: Node, times: list[float], index: int, length: int
    ):
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

    def _send_node_progress_done(self, node: Node, length: int):
        self.queue.put(
            {
                "event": "node-progress",
                "data": {
                    "nodeId": node.id,
                    "progress": 1,
                    "index": length,
                    "total": length,
                    "eta": 0,
                },
            }
        )

    def _send_node_broadcast(
        self,
        node: Node,
        output: Output,
        generators: Iterable[Generator] | None = None,
    ):
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

    def _send_node_finish(self, node: Node, execution_time: float):
        self.queue.put(
            {
                "event": "node-finish",
                "data": {"nodeId": node.id, "executionTime": execution_time},
            }
        )
