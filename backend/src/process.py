from __future__ import annotations

import asyncio
import functools
import gc
import time
import typing
from collections.abc import Callable, Iterable, Sequence
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
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
from chain.cache import CacheStrategy, OutputCache, StaticCaching, get_cache_strategies
from chain.chain import Chain, CollectorNode, FunctionNode, GeneratorNode, Node
from chain.input import EdgeInput, Input, InputMap
from events import EventConsumer, InputsDict, NodeBroadcastData
from logger import logger
from progress_controller import Aborted, ProgressController, ProgressToken
from util import combine_sets, timed_supplier

Output = list[object]


def collect_input_information(
    node: NodeData,
    inputs: list[object | Lazy[object]],
    enforced: bool = True,
) -> InputsDict:
    try:
        input_dict: InputsDict = {}

        for value, node_input in zip(inputs, node.inputs, strict=False):
            if isinstance(value, Lazy) and value.has_value:
                value = value.value  # noqa: PLW2901

            if isinstance(value, Lazy):
                # the value hasn't been computed yet, so we won't do so here
                input_dict[node_input.id] = {"type": "pending"}
                continue

            if not enforced:
                try:
                    value = node_input.enforce_(value)  # noqa
                except Exception:
                    logger.exception(
                        "Error enforcing input %s (id %s)",
                        node_input.label,
                        node_input.id,
                    )
                    # We'll just try using the un-enforced value. Maybe it'll work.

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
        # this method must not throw
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
        raise NodeExecutionError(node_id, node, str(e), input_dict) from e


def enforce_output(raw_output: object, node: NodeData) -> RegularOutput:
    l = len(node.outputs)

    output: Output
    if l == 0:
        assert raw_output is None, f"Expected all {node.name} nodes to return None."
        output = []
    elif l == 1:
        output = [raw_output]
    else:
        assert isinstance(raw_output, tuple | list)
        output = list(raw_output)
        assert len(output) == l, (
            f"Expected all {node.name} nodes to have {l} output(s) but found {len(output)}."
        )

    # output-specific validations
    for i, o in enumerate(node.outputs):
        output[i] = o.enforce(output[i])

    return RegularOutput(output)


def enforce_generator_output(raw_output: object, node: NodeData) -> GeneratorOutput:
    l = len(node.outputs)
    generator_output = node.single_iterable_output

    partial: list[object] = [None] * l

    if l == len(generator_output.outputs):
        assert isinstance(raw_output, Generator), (
            "Expected the output to be a generator"
        )
        return GeneratorOutput(
            info=generator_output,
            generator=raw_output,
            partial_output=partial,
        )

    assert l > len(generator_output.outputs)
    assert isinstance(raw_output, tuple | list)

    iterator, *rest = raw_output
    assert isinstance(iterator, Generator), (
        "Expected the first tuple element to be a generator"
    )
    assert len(rest) == l - len(generator_output.outputs)

    # output-specific validations
    for i, o in enumerate(node.outputs):
        if o.id not in generator_output.outputs:
            partial[i] = o.enforce(rest.pop(0))

    return GeneratorOutput(
        info=generator_output,
        generator=iterator,
        partial_output=partial,
    )


def run_node(
    node: NodeData, context: NodeContext, inputs: list[object], node_id: NodeId
) -> NodeOutput | CollectorOutput:
    if node.kind == "collector":
        ignored_inputs = node.single_iterable_input.inputs
    else:
        ignored_inputs = []

    enforced_inputs = enforce_inputs(inputs, node, node_id, ignored_inputs)

    try:
        if node.node_context:
            raw_output = node.run(context, *enforced_inputs)
        else:
            raw_output = node.run(*enforced_inputs)

        if node.kind == "collector":
            assert isinstance(raw_output, Collector)
            return CollectorOutput(raw_output)
        if node.kind == "generator":
            return enforce_generator_output(raw_output, node)

        assert node.kind == "regularNode"
        return enforce_output(raw_output, node)
    except Aborted:
        raise
    except NodeExecutionError:
        raise
    except Exception as e:
        # collect information to provide good error messages
        input_dict = collect_input_information(node, enforced_inputs)
        raise NodeExecutionError(node_id, node, str(e), input_dict) from e


def run_collector_iterate(
    node: CollectorNode, inputs: list[object], collector: Collector
) -> None:
    iterable_input = node.data.single_iterable_input

    def get_partial_inputs(values: list[object]) -> list[object]:
        partial_inputs: list[object] = []
        index = 0
        for i in node.data.inputs:
            if i.id in iterable_input.inputs:
                partial_inputs.append(values[index])
                index += 1
            else:
                partial_inputs.append(None)
        return partial_inputs

    enforced_inputs: list[object] = []
    try:
        for i in node.data.inputs:
            if i.id in iterable_input.inputs:
                enforced_inputs.append(i.enforce_(inputs[len(enforced_inputs)]))
    except Exception as e:
        input_dict = collect_input_information(
            node.data, get_partial_inputs(inputs), enforced=False
        )
        raise NodeExecutionError(node.id, node.data, str(e), input_dict) from e

    input_value = (
        enforced_inputs[0] if len(enforced_inputs) == 1 else tuple(enforced_inputs)
    )

    try:
        raw_output = collector.on_iterate(input_value)
        assert raw_output is None
    except Exception as e:
        input_dict = collect_input_information(
            node.data, get_partial_inputs(enforced_inputs)
        )
        raise NodeExecutionError(node.id, node.data, str(e), input_dict) from e


class _Timer:
    def __init__(self) -> None:
        self.duration: float = 0

    @contextmanager
    def run(self):
        start = time.monotonic()
        try:
            yield None
        finally:
            self.add_since(start)

    def add_since(self, start: float):
        self.duration += time.monotonic() - start


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

ExecutionId = NewType("ExecutionId", str)


class _ExecutorNodeContext(NodeContext):
    def __init__(
        self, progress: ProgressToken, settings: SettingsParser, storage_dir: Path
    ) -> None:
        super().__init__()

        self.progress = progress
        self.__settings = settings
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
        self.check_aborted()

        # TODO: send progress event

    @property
    def settings(self) -> SettingsParser:
        """
        Returns the settings of the current node execution.
        """
        return self.__settings

    @property
    def storage_dir(self) -> Path:
        return self._storage_dir

    def add_cleanup(
        self, fn: Callable[[], None], after: Literal["node", "chain"] = "chain"
    ) -> None:
        if after == "chain":
            self.chain_cleanup_fns.add(fn)
        elif after == "node":
            self.node_cleanup_fns.add(fn)
        else:
            raise ValueError(f"Unknown cleanup type: {after}")


class Executor:
    """
    Class for executing chaiNNer's processing logic.

    The Executor handles chain execution with support for:
    - Regular nodes (standard function nodes)
    - Generator nodes (produce sequences of values)
    - Collector nodes (accumulate values from sequences)

    Current Architecture:
    ---------------------
    Regular execution uses a bottom-up (depth-first) approach where leaf nodes
    (nodes with side effects) trigger computation of their dependencies.

    Iteration uses a hybrid approach:
    1. Generators are processed first to create iterators
    2. The executor loops through all iterations
    3. For each iteration, values are cached and pushed to downstream nodes
    4. Output nodes and collectors consume the values

    Future Direction:
    -----------------
    To support nested iteration and transformer nodes, the architecture should
    move to a pure pull-based model where:
    - All nodes become iterators
    - Leaf nodes pull values from parents via next()
    - Static nodes yield the same value repeatedly
    - Generators yield different values per iteration
    - Multi-consumer nodes cache values per iteration

    This would enable:
    - Nested iteration (e.g., processing videos within folders)
    - Transformer nodes (filtering, limiting, combining sequences)
    - More intuitive iteration semantics
    """

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
        self.id: ExecutionId = id
        self.chain = chain
        self.inputs: InputMap = InputMap.from_chain(chain)
        self.send_broadcast_data: bool = send_broadcast_data
        self.options: ExecutionOptions = options
        self.node_cache: OutputCache[NodeOutput] = OutputCache(parent=parent_cache)
        self.__broadcast_tasks: list[asyncio.Task[None]] = []
        self.__context_cache: dict[str, _ExecutorNodeContext] = {}

        self.progress = ProgressController()

        self.loop: asyncio.AbstractEventLoop = loop
        self.queue: EventConsumer = queue
        self.pool: ThreadPoolExecutor = pool

        self.cache_strategy: dict[NodeId, CacheStrategy] = get_cache_strategies(chain)

        self._storage_dir = storage_dir

    async def process(
        self, node_id: NodeId, perform_cache: bool = True
    ) -> NodeOutput | CollectorOutput:
        # Return cached output value from an already-run node if that cached output exists
        if perform_cache:
            cached = self.node_cache.get(node_id)
            if cached is not None:
                return cached

        node = self.chain.nodes[node_id]
        try:
            return await self.__process(node, perform_cache)
        except Aborted:
            raise
        except NodeExecutionError:
            raise
        except Exception as e:
            raise NodeExecutionError(node.id, node.data, str(e), {}) from e

    async def process_regular_node(self, node: FunctionNode) -> RegularOutput:
        """
        Processes the given regular node.

        This will run all necessary node events.
        """
        result = await self.process(node.id)
        assert isinstance(result, RegularOutput)
        return result

    async def process_generator_node(
        self, node: GeneratorNode, perform_cache: bool = True
    ) -> GeneratorOutput:
        """
        Processes the given iterator node.

        This will **not** iterate the returned generator. Only `node-start` and
        `node-broadcast` events will be sent.
        """
        result = await self.process(node.id, perform_cache)
        assert isinstance(result, GeneratorOutput)
        return result

    async def process_collector_node(self, node: CollectorNode) -> CollectorOutput:
        """
        Processes the given collector node.

        This will **not** iterate the returned collector. Only a `node-start` event
        will be sent.
        """
        result = await self.process(node.id)
        assert isinstance(result, CollectorOutput)
        return result

    async def __get_node_output(self, node_id: NodeId, output_index: int) -> object:
        """
        Returns the output value of the given node.

        Note: `output_index` is NOT an output ID.
        """

        # Recursively get the value of the input
        output = await self.process(node_id)

        if isinstance(output, CollectorOutput):
            # this generally shouldn't be possible
            raise ValueError("A collector was not run before another node needed it.")

        if isinstance(output, GeneratorOutput):
            value = output.partial_output[output_index]
            assert value is not None, "A generator output was not assigned correctly"
            return value

        assert isinstance(output, RegularOutput)
        return output.output[output_index]

    async def __resolve_node_input(self, node_input: Input) -> object:
        if isinstance(node_input, EdgeInput):
            # If input is a dict indicating another node, use that node's output value
            # Recursively get the value of the input
            return await self.__get_node_output(node_input.id, node_input.index)
        else:
            # Otherwise, just use the given input (number, string, etc)
            return node_input.value

    async def __gather_inputs(self, node: Node) -> list[object]:
        """
        Returns the list of input values for the given node.
        """

        # we want to ignore some inputs if we are running a collector node
        ignore: set[int] = set()
        if isinstance(node, CollectorNode):
            iterable_input = node.data.single_iterable_input
            for input_index, i in enumerate(node.data.inputs):
                if i.id in iterable_input.inputs:
                    ignore.add(input_index)

        # some inputs are lazy, so we want to lazily resolve them
        lazy: set[int] = set()
        for input_index, i in enumerate(node.data.inputs):
            if i.lazy:
                lazy.add(input_index)

        assigned_inputs = self.inputs.get(node.id)
        assert len(assigned_inputs) == len(node.data.inputs)

        async def get_input_value(input_index: int, node_input: Input):
            if input_index in ignore:
                return None

            if input_index in lazy:
                return Lazy.from_coroutine(
                    self.__resolve_node_input(assigned_inputs[input_index]), self.loop
                )

            return await self.__resolve_node_input(node_input)

        inputs = []
        for input_index, node_input in enumerate(assigned_inputs):
            inputs.append(await get_input_value(input_index, node_input))

        return inputs

    async def __gather_collector_inputs(self, node: CollectorNode) -> list[object]:
        """
        Returns the input values to be consumed by `Collector.on_iterate`.
        """

        iterable_input = node.data.single_iterable_input

        assigned_inputs = self.inputs.get(node.id)
        assert len(assigned_inputs) == len(node.data.inputs)

        inputs = []
        for input_index, node_input in enumerate(assigned_inputs):
            i = node.data.inputs[input_index]
            if i.id in iterable_input.inputs:
                inputs.append(await self.__resolve_node_input(node_input))

        return inputs

    def __get_node_context(self, node: Node) -> _ExecutorNodeContext:
        context = self.__context_cache.get(node.data.schema_id, None)
        if context is None:
            package_id = registry.get_package(node.data.schema_id).id
            settings = self.options.get_package_settings(package_id)

            context = _ExecutorNodeContext(self.progress, settings, self._storage_dir)
            self.__context_cache[node.data.schema_id] = context

        return context

    async def __process(
        self, node: Node, perform_cache: bool = True
    ) -> NodeOutput | CollectorOutput:
        """
        Process a single node.

        In the case of generator and collectors, it will only run the node itself,
        not the actual iteration or collection.
        """

        logger.debug("node: %s", node)
        logger.debug("Running node %s", node.id)

        inputs = await self.__gather_inputs(node)
        context = self.__get_node_context(node)

        def get_lazy_evaluation_time():
            return sum(i.evaluation_time for i in inputs if isinstance(i, Lazy))

        await self.progress.suspend()
        self.__send_node_start(node)
        await self.progress.suspend()

        lazy_time_before = get_lazy_evaluation_time()

        output, execution_time = await self.loop.run_in_executor(
            self.pool,
            timed_supplier(
                functools.partial(run_node, node.data, context, inputs, node.id)
            ),
        )
        await self.progress.suspend()

        for fn in context.node_cleanup_fns:
            try:
                fn()
            except Exception as e:
                logger.error("Error running cleanup function: %s", e)
            finally:
                context.node_cleanup_fns.remove(fn)

        lazy_time_after = get_lazy_evaluation_time()
        execution_time -= lazy_time_after - lazy_time_before

        if isinstance(output, RegularOutput):
            await self.__send_node_broadcast(node, output.output)
            self.__send_node_finish(node, execution_time)
        elif isinstance(output, GeneratorOutput):
            await self.__send_node_broadcast(
                node,
                output.partial_output,
                generators=[output.generator],
            )
            # TODO: execution time

        # Cache the output of the node
        if perform_cache and not isinstance(output, CollectorOutput):
            self.node_cache.set(node.id, output, self.cache_strategy[node.id])

        await self.progress.suspend()

        return output

    def __get_iterated_nodes(
        self, node: GeneratorNode
    ) -> tuple[set[CollectorNode], set[FunctionNode], set[Node]]:
        """
        Returns all collector and output nodes iterated by the given generator node.

        This method traverses the graph from the generator node following only
        iterator outputs to find all downstream nodes that need to be executed
        during iteration.

        Note: Nested iteration is not currently supported. To support it, the
        execution model would need to be changed to a pull-based architecture
        where nested generators can be consumed by parent generators.

        Returns:
            Tuple of (collectors, output_nodes, all_visited_nodes)
        """
        collectors: set[CollectorNode] = set()
        output_nodes: set[FunctionNode] = set()

        seen: set[Node] = {node}

        def visit(n: Node):
            if n in seen:
                return
            seen.add(n)

            if isinstance(n, CollectorNode):
                collectors.add(n)
            elif isinstance(n, GeneratorNode):
                # TODO: Support nested iteration by implementing a pull-based
                # architecture where parent generators request values from
                # nested generators using Python's iterator protocol
                raise ValueError("Nested sequences are not supported")
            else:
                assert isinstance(n, FunctionNode)

                if n.has_side_effects():
                    output_nodes.add(n)

                # follow edges
                for edge in self.chain.edges_from(n.id):
                    target_node = self.chain.nodes[edge.target.id]
                    visit(target_node)

        iterable_output = node.data.single_iterable_output
        for edge in self.chain.edges_from(node.id):
            # only follow iterator outputs
            if edge.source.output_id in iterable_output.outputs:
                target_node = self.chain.nodes[edge.target.id]
                visit(target_node)

        return collectors, output_nodes, seen

    def __generator_fill_partial_output(
        self, node: GeneratorNode, partial_output: Output, values: object
    ) -> Output:
        iterable_output = node.data.single_iterable_output

        values_list: list[object] = []
        if len(iterable_output.outputs) == 1:
            values_list.append(values)
        else:
            assert isinstance(values, tuple | list)
            values_list.extend(values)

        assert len(values_list) == len(iterable_output.outputs)

        output: Output = partial_output.copy()
        for index, o in enumerate(node.data.outputs):
            if o.id in iterable_output.outputs:
                output[index] = o.enforce(values_list.pop(0))

        return output

    async def __setup_iteration(
        self, generator_nodes: list[GeneratorNode]
    ) -> tuple[
        list[tuple[Collector, _Timer, CollectorNode]],
        set[FunctionNode],
        set[NodeId],
        dict[NodeId, typing.Iterator[Output | Exception]],
        dict[NodeId, _IterationTimer],
        dict[NodeId, int],
    ]:
        """
        Set up iteration context for generator nodes.

        This prepares all data structures needed for iteration, including:
        - Creating iterators from generators
        - Finding and initializing collectors
        - Finding output nodes
        - Setting up timing and progress tracking

        Returns:
            Tuple of (collectors, output_nodes, iterated_nodes, iterators, timers, expected_lengths)
        """
        collectors: list[tuple[Collector, _Timer, CollectorNode]] = []
        output_nodes: set[FunctionNode] = set()
        all_iterated_nodes: set[NodeId] = set()
        generator_suppliers: dict[NodeId, typing.Iterator[Output | Exception]] = {}
        iter_timers: dict[NodeId, _IterationTimer] = {}
        expected_lengths: dict[NodeId, int] = {}

        # Process each generator node
        for node in generator_nodes:
            generator_output = await self.process_generator_node(node)
            generator_suppliers[node.id] = (
                generator_output.generator.supplier().__iter__()
            )

            # Find all nodes affected by this generator
            collector_nodes, __output_nodes, __all_iterated_nodes = (
                self.__get_iterated_nodes(node)
            )

            # Track all iterated nodes for cache management
            for iterated_node in __all_iterated_nodes:
                all_iterated_nodes.add(iterated_node.id)

            # Collect output nodes (nodes with side effects)
            for o_node in __output_nodes:
                output_nodes.add(o_node)

            # Initialize collectors
            for collector_node in collector_nodes:
                await self.progress.suspend()
                timer = _Timer()
                with timer.run():
                    collector_output = await self.process_collector_node(collector_node)
                assert isinstance(collector_output, CollectorOutput)
                collectors.append((collector_output.collector, timer, collector_node))

            # Set up iteration tracking
            expected_length = generator_output.generator.expected_length
            expected_lengths[node.id] = expected_length
            iter_timers[node.id] = _IterationTimer(self.progress)

            # Send initial progress
            self.__send_node_progress(node, [], 0, expected_length)

        # Validate that all generators have compatible lengths
        if len(set(expected_lengths.values())) > 1:
            raise AssertionError(
                "Expected all connected iterators to have the same length"
            )

        return (
            collectors,
            output_nodes,
            all_iterated_nodes,
            generator_suppliers,
            iter_timers,
            expected_lengths,
        )

    async def __run_single_iteration(
        self,
        generator_nodes: list[GeneratorNode],
        generator_suppliers: dict[NodeId, typing.Iterator[Output | Exception]],
        output_nodes: set[FunctionNode],
        collectors: list[tuple[Collector, _Timer, CollectorNode]],
        all_iterated_nodes: set[NodeId],
    ) -> None:
        """
        Run a single iteration step.

        This:
        1. Advances each generator to get new values
        2. Caches and broadcasts those values
        3. Runs all output nodes with the new values
        4. Runs all collectors with the new values

        Args:
            generator_nodes: List of generator nodes
            generator_suppliers: Iterators for each generator
            output_nodes: Set of output nodes to execute
            collectors: List of collectors to update
            all_iterated_nodes: Set of node IDs to clear from cache
        """
        # Advance each generator and cache its values
        for node in generator_nodes:
            generator_output = await self.process_generator_node(node)
            generator_supplier = generator_suppliers[node.id]

            values = next(generator_supplier)

            # Check if the generator yielded an exception
            if isinstance(values, Exception):
                raise values

            # Cache current iteration's values
            iter_output = RegularOutput(
                self.__generator_fill_partial_output(
                    node, generator_output.partial_output, values
                )
            )
            self.node_cache.set(node.id, iter_output, StaticCaching)

            # Broadcast current values
            await self.__send_node_broadcast(node, iter_output.output)

        # Execute all output nodes with current iteration's values
        for output_node in output_nodes:
            await self.process_regular_node(output_node)

        # Update all collectors with current iteration's values
        for collector, timer, collector_node in collectors:
            await self.progress.suspend()
            iterate_inputs = await self.__gather_collector_inputs(collector_node)
            await self.progress.suspend()
            with timer.run():
                run_collector_iterate(collector_node, iterate_inputs, collector)

        # Clear cached iteration values (they'll be recomputed next iteration)
        self.node_cache.delete_many(all_iterated_nodes)

    async def __finalize_iteration(
        self,
        generator_nodes: list[GeneratorNode],
        collectors: list[tuple[Collector, _Timer, CollectorNode]],
        all_iterated_nodes: set[NodeId],
        iter_timers: dict[NodeId, _IterationTimer],
    ) -> None:
        """
        Finalize iteration by completing collectors and cleaning up.

        This:
        1. Clears iteration caches
        2. Restores generator nodes to their original state
        3. Completes all collectors
        4. Sends completion events

        Args:
            generator_nodes: List of generator nodes
            collectors: List of collectors to complete
            all_iterated_nodes: Set of node IDs to clear from cache
            iter_timers: Timing information for each generator
        """
        # Clear iteration caches
        self.node_cache.delete_many(all_iterated_nodes)

        # Restore generator nodes
        for node in generator_nodes:
            generator_output = await self.process_generator_node(node)
            self.node_cache.set(node.id, generator_output, self.cache_strategy[node.id])

            # Re-broadcast final value
            await self.__send_node_broadcast(node, generator_output.partial_output)

            # Send completion events
            self.__send_node_progress_done(node, iter_timers[node.id].iterations)
            self.__send_node_finish(node, iter_timers[node.id].get_time_since_start())

        # Complete all collectors
        for collector, timer, collector_node in collectors:
            await self.progress.suspend()
            with timer.run():
                collector_output = enforce_output(
                    collector.on_complete(), collector_node.data
                )

            await self.__send_node_broadcast(collector_node, collector_output.output)
            self.__send_node_finish(collector_node, timer.duration)

            self.node_cache.set(
                collector_node.id,
                collector_output,
                self.cache_strategy[collector_node.id],
            )

    async def __iterate_generator_nodes(self, generator_nodes: list[GeneratorNode]):
        """
        Execute iteration for generator nodes.

        This is the main iteration method that coordinates the entire iteration
        process. It has been refactored into smaller, more focused methods to
        improve maintainability and make it easier to extend with features like
        transformer nodes and nested iteration.

        The iteration process:
        1. Setup: Initialize generators, collectors, and tracking data
        2. Loop: Run iterations until all generators are exhausted
        3. Finalize: Complete collectors and send completion events

        Args:
            generator_nodes: List of generator nodes to iterate
        """
        await self.progress.suspend()

        # Setup iteration context
        (
            collectors,
            output_nodes,
            all_iterated_nodes,
            generator_suppliers,
            iter_timers,
            expected_lengths,
        ) = await self.__setup_iteration(generator_nodes)

        # Early exit if no consumers
        if not collectors and not output_nodes:
            # Unusual, but can happen if generator outputs aren't connected
            # to any collectors or output nodes
            return

        # Run iteration loop
        num_generators = len(generator_nodes)
        total_stopiters = 0
        deferred_errors: list[str] = []

        while True:
            generator_output = None

            try:
                # Run one iteration step
                await self.__run_single_iteration(
                    generator_nodes,
                    generator_suppliers,
                    output_nodes,
                    collectors,
                    all_iterated_nodes,
                )

                # Update progress for all generators
                await self.progress.suspend()
                for node in generator_nodes:
                    iter_times = iter_timers[node.id]
                    iter_times.add()
                    iterations = iter_times.iterations
                    self.__send_node_progress(
                        node,
                        iter_times.times,
                        iterations,
                        max(expected_lengths[node.id], iterations),
                    )

                # Yield to event loop
                await asyncio.sleep(0)
                await self.progress.suspend()

            except Aborted:
                raise
            except StopIteration:
                # One or more generators exhausted
                total_stopiters += 1
                if total_stopiters >= num_generators:
                    break
            except Exception as e:
                # Handle errors based on fail_fast setting
                # Note: we need to get the generator output to check fail_fast
                try:
                    for node in generator_nodes:
                        generator_output = await self.process_generator_node(node)
                        if generator_output.generator.fail_fast:
                            raise e
                except Exception as check_error:
                    # If we can't determine fail_fast, raise the original error
                    raise e from check_error

                # Collect error for deferred handling
                deferred_errors.append(str(e))

        # Finalize iteration
        await self.__finalize_iteration(
            generator_nodes, collectors, all_iterated_nodes, iter_timers
        )

        # Raise any collected errors
        if deferred_errors:
            error_string = "- " + "\n- ".join(deferred_errors)
            raise Exception(f"Errors occurred during iteration:\n{error_string}")

    async def __process_nodes(self):
        self.__send_chain_start()

        generator_nodes: list[GeneratorNode] = []

        # Group nodes to run by shared lineage
        # TODO: there's probably a better way of doing this
        gens_by_outs: dict[NodeId, set[NodeId]] = {}
        for node_id in self.chain.topological_order():
            node = self.chain.nodes[node_id]
            if isinstance(node, GeneratorNode):
                # we first need to run generator nodes in topological order
                generator_nodes.append(node)
                collector_nodes, output_nodes, __all_iterated_nodes = (
                    self.__get_iterated_nodes(node)
                )
                for collector in collector_nodes:
                    if gens_by_outs.get(collector.id, None) is not None:
                        gens_by_outs[collector.id].add(node.id)
                    else:
                        gens_by_outs[collector.id] = {node.id}
                for out_node in output_nodes:
                    if gens_by_outs.get(out_node.id, None) is not None:
                        gens_by_outs[out_node.id].add(node.id)
                    else:
                        gens_by_outs[out_node.id] = {node.id}

        groups: list[set[NodeId]] = list(gens_by_outs.values())
        combined_groups = combine_sets(groups)

        # TODO: Look for a way to avoid duplicating this work
        for group in combined_groups:
            nodes_to_run: list[GeneratorNode] = []
            for node_id in group:
                generator_node = self.chain.nodes[node_id]
                if isinstance(generator_node, GeneratorNode):
                    nodes_to_run.append(generator_node)
            await self.__iterate_generator_nodes(nodes_to_run)

        # now the output nodes outside of iterators

        # Now run everything that is not in an iterator lineage
        non_iterable_output_nodes = [
            node
            for node, iter_node in self.chain.get_parent_iterator_map().items()
            if iter_node is None and node.has_side_effects()
        ]
        for output_node in non_iterable_output_nodes:
            await self.progress.suspend()
            await self.process_regular_node(output_node)

        # clear cache after the chain is done
        self.node_cache.clear()

        # Run cleanup functions
        for context in self.__context_cache.values():
            for fn in context.chain_cleanup_fns:
                try:
                    fn()
                except Exception as e:
                    logger.error("Error running cleanup function: %s", e)

        # await all broadcasts
        tasks = self.__broadcast_tasks
        self.__broadcast_tasks = []
        for task in tasks:
            await task

    async def run(self):
        logger.debug("Running executor %s", self.id)
        try:
            await self.__process_nodes()
        finally:
            gc.collect()

    def resume(self):
        logger.debug("Resuming executor %s", self.id)
        self.progress.resume()

    def pause(self):
        logger.debug("Pausing executor %s", self.id)
        self.progress.pause()
        gc.collect()

    def kill(self):
        logger.debug("Killing executor %s", self.id)
        self.progress.abort()

    # events

    def __send_chain_start(self):
        # all nodes except the cached ones
        nodes = set(self.chain.nodes.keys())
        nodes.difference_update(self.node_cache.keys())

        self.queue.put(
            {
                "event": "chain-start",
                "data": {
                    "nodes": list(nodes),
                },
            }
        )

    def __send_node_start(self, node: Node):
        self.queue.put(
            {
                "event": "node-start",
                "data": {
                    "nodeId": node.id,
                },
            }
        )

    def __send_node_progress(
        self, node: Node, times: Sequence[float], index: int, length: int
    ):
        def get_eta(times: Sequence[float]) -> float:
            avg_time = 0
            if len(times) > 0:
                # only consider the last 100
                times = times[-100:]

                # use a weighted average
                weights = [max(1 / i, 0.9**i) for i in range(len(times), 0, -1)]
                avg_time = sum(
                    t * w for t, w in zip(times, weights, strict=False)
                ) / sum(weights)

            remaining = max(0, length - index)
            return avg_time * remaining

        self.queue.put(
            {
                "event": "node-progress",
                "data": {
                    "nodeId": node.id,
                    "progress": 1 if length == 0 else index / length,
                    "index": index,
                    "total": length,
                    "eta": get_eta(times),
                },
            }
        )

    def __send_node_progress_done(self, node: Node, length: int):
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

    async def __send_node_broadcast(
        self,
        node: Node,
        output: Output,
        generators: Iterable[Generator] | None = None,
    ):
        def compute_broadcast_data():
            if self.progress.aborted:
                # abort the broadcast if the chain was aborted
                return None
            foo = compute_broadcast(output, node.data.outputs)
            if generators is None:
                return (*foo, {}, {})
            return (
                *foo,
                *compute_sequence_broadcast(generators, node.data.iterable_outputs),
            )

        async def send_broadcast():
            # TODO: Add the time it takes to compute the broadcast data to the execution time
            result = await self.loop.run_in_executor(self.pool, compute_broadcast_data)
            if result is None or self.progress.aborted:
                return

            data, types, sequence_types, item_types = result

            # assign item types
            for output_id, type in item_types.items():
                types[output_id] = type

            evant_data: NodeBroadcastData = {
                "nodeId": node.id,
                "data": data,
                "types": types,
                "sequenceTypes": sequence_types,
            }
            self.queue.put({"event": "node-broadcast", "data": evant_data})

        # Only broadcast the output if the node has outputs
        if self.send_broadcast_data and len(node.data.outputs) > 0:
            # broadcasts are done is parallel, so don't wait
            self.__broadcast_tasks.append(self.loop.create_task(send_broadcast()))

    def __send_node_finish(
        self,
        node: Node,
        execution_time: float,
    ):
        self.queue.put(
            {
                "event": "node-finish",
                "data": {
                    "nodeId": node.id,
                    "executionTime": execution_time,
                },
            }
        )
