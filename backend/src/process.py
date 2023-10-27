from __future__ import annotations

import asyncio
import functools
import gc
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterable, List, Union

from api import Collector, Iterator, NodeData
from base_types import InputId, NodeId, OutputId
from chain.cache import CacheStrategy, OutputCache, StaticCaching, get_cache_strategies
from chain.chain import Chain, CollectorNode, FunctionNode, NewIteratorNode, Node
from chain.input import EdgeInput, Input, InputMap
from events import Event, EventQueue, InputsDict
from nodes.base_output import BaseOutput
from progress_controller import Aborted, ProgressController
from sanic.log import logger
from util import timed_supplier

Output = List[object]


def collect_input_information(
    node: NodeData,
    inputs: list[object],
    enforced: bool = True,
) -> InputsDict:
    try:
        input_dict: InputsDict = {}

        for value, node_input in zip(inputs, node.inputs):
            if not enforced:
                try:
                    value = node_input.enforce_(value)  # noqa
                except Exception as e:
                    logger.error(
                        f"Error enforcing input {node_input.label} (id {node_input.id})",
                        e,
                    )
                    # We'll just try using the un-enforced value. Maybe it'll work.

            try:
                input_dict[node_input.id] = node_input.get_error_value(value)
            except Exception as e:
                logger.error(
                    f"Error getting error value for input {node_input.label} (id {node_input.id})",
                    e,
                )

        return input_dict
    except Exception as outer_e:
        # this method must not throw
        logger.error("Error collecting input information.", outer_e)
        return {}


def enforce_inputs(
    inputs: list[object],
    node: NodeData,
    node_id: NodeId,
    ignored_inputs: list[InputId],
) -> list[object]:
    try:
        enforced_inputs: list[object] = []

        for index, value in enumerate(inputs):
            i = node.inputs[index]
            if i.id in ignored_inputs:
                enforced_inputs.append(None)
            else:
                enforced_inputs.append(i.enforce_(value))

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
        assert isinstance(raw_output, (tuple, list))
        output = list(raw_output)
        assert (
            len(output) == l
        ), f"Expected all {node.name} nodes to have {l} output(s) but found {len(output)}."

    # output-specific validations
    for i, o in enumerate(node.outputs):
        output[i] = o.enforce(output[i])

    return RegularOutput(output)


def enforce_iterator_output(raw_output: object, node: NodeData) -> IteratorOutput:
    l = len(node.outputs)
    iterator_output = node.single_iterator_output

    partial: list[object] = [None] * l

    if l == len(iterator_output.outputs):
        assert isinstance(raw_output, Iterator), "Expected the output to be an iterator"
        return IteratorOutput(iterator=raw_output, partial_output=partial)

    assert l > len(iterator_output.outputs)
    assert isinstance(raw_output, (tuple, list))

    iterator, *rest = raw_output
    assert isinstance(
        iterator, Iterator
    ), "Expected the first tuple element to be an iterator"
    assert len(rest) == l - len(iterator_output.outputs)

    # output-specific validations
    for i, o in enumerate(node.outputs):
        if o.id not in iterator_output.outputs:
            partial[i] = o.enforce(rest.pop(0))

    return IteratorOutput(iterator=iterator, partial_output=partial)


def run_node(
    node: NodeData, inputs: list[object], node_id: NodeId
) -> NodeOutput | CollectorOutput:
    if node.type == "collector":
        ignored_inputs = node.single_iterator_input.inputs
    else:
        ignored_inputs = []

    enforced_inputs = enforce_inputs(inputs, node, node_id, ignored_inputs)

    try:
        raw_output = node.run(*enforced_inputs)

        if node.type == "collector":
            assert isinstance(raw_output, Collector)
            return CollectorOutput(raw_output)
        if node.type == "newIterator":
            return enforce_iterator_output(raw_output, node)

        assert node.type == "regularNode"
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
    iterator_input = node.data.single_iterator_input

    def get_partial_inputs(values: list[object]) -> list[object]:
        partial_inputs: list[object] = []
        index = 0
        for i in node.data.inputs:
            if i.id in iterator_input.inputs:
                partial_inputs.append(values[index])
                index += 1
            else:
                partial_inputs.append(None)
        return partial_inputs

    enforced_inputs: list[object] = []
    try:
        for i in node.data.inputs:
            if i.id in iterator_input.inputs:
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
        start = time.time()
        try:
            yield None
        finally:
            self.add_since(start)

    def add_since(self, start: float):
        self.duration += time.time() - start


def compute_broadcast(output: Output, node_outputs: Iterable[BaseOutput]):
    data: dict[OutputId, object] = dict()
    types: dict[OutputId, object] = dict()
    for index, node_output in enumerate(node_outputs):
        try:
            value = output[index]
            if value is not None:
                data[node_output.id] = node_output.get_broadcast_data(value)
                types[node_output.id] = node_output.get_broadcast_type(value)
        except Exception as e:
            logger.error(f"Error broadcasting output: {e}")
    return data, types


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
class IteratorOutput:
    iterator: Iterator
    partial_output: Output


@dataclass(frozen=True)
class CollectorOutput:
    collector: Collector


NodeOutput = Union[RegularOutput, IteratorOutput]


class Executor:
    """
    Class for executing chaiNNer's processing logic
    """

    def __init__(
        self,
        chain: Chain,
        inputs: InputMap,
        send_broadcast_data: bool,
        loop: asyncio.AbstractEventLoop,
        queue: EventQueue,
        pool: ThreadPoolExecutor,
        parent_cache: OutputCache[NodeOutput] | None = None,
    ):
        self.execution_id: str = uuid.uuid4().hex
        self.chain = chain
        self.inputs = inputs
        self.send_broadcast_data: bool = send_broadcast_data
        self.cache: OutputCache[NodeOutput] = OutputCache(parent=parent_cache)
        self.__broadcast_tasks: list[asyncio.Task[None]] = []

        self.progress = ProgressController()

        self.completed_node_ids = set()

        self.loop: asyncio.AbstractEventLoop = loop
        self.queue: EventQueue = queue
        self.pool: ThreadPoolExecutor = pool

        self.cache_strategy: dict[NodeId, CacheStrategy] = get_cache_strategies(chain)

    @property
    def completed_percentage(self) -> float:
        completed = self.cache.keys().union(self.completed_node_ids)
        return len(completed) / len(self.chain.nodes)

    async def process(self, node_id: NodeId) -> NodeOutput | CollectorOutput:
        # Return cached output value from an already-run node if that cached output exists
        cached = self.cache.get(node_id)
        if cached is not None:
            return cached

        node = self.chain.nodes[node_id]
        try:
            return await self.__process(node)
        except Aborted:
            raise
        except NodeExecutionError:
            raise
        except Exception as e:
            raise NodeExecutionError(node.id, node.data, str(e), {}) from e

    async def process_regular_node(self, node_id: NodeId) -> RegularOutput:
        assert self.chain.nodes[node_id].data.type == "regularNode"
        result = await self.process(node_id)
        assert isinstance(result, RegularOutput)
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

        if isinstance(output, IteratorOutput):
            value = output.partial_output[output_index]
            assert value is not None, "An iterator output was not assigned correctly"
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
            iterator_input = node.data.single_iterator_input
            for input_index, i in enumerate(node.data.inputs):
                if i.id in iterator_input.inputs:
                    ignore.add(input_index)

        assigned_inputs = self.inputs.get(node.id)
        assert len(assigned_inputs) == len(node.data.inputs)

        inputs = []
        for input_index, node_input in enumerate(assigned_inputs):
            if input_index in ignore:
                inputs.append(None)
            else:
                inputs.append(await self.__resolve_node_input(node_input))

        return inputs

    async def __gather_collector_inputs(self, node: Node) -> list[object]:
        """
        Returns the input values to be consumed by `Collector.on_iterate`.
        """

        assert isinstance(node, CollectorNode)
        assert node.data.type == "collector"

        iterator_input = node.data.single_iterator_input

        assigned_inputs = self.inputs.get(node.id)
        assert len(assigned_inputs) == len(node.data.inputs)

        inputs = []
        for input_index, node_input in enumerate(assigned_inputs):
            i = node.data.inputs[input_index]
            if i.id in iterator_input.inputs:
                inputs.append(await self.__resolve_node_input(node_input))

        return inputs

    async def __process(self, node: Node) -> NodeOutput | CollectorOutput:
        """
        Process a single node.

        In the case of iterators and collectors, it will only run the node itself,
        not the actual iteration or collection.
        """

        logger.debug(f"node: {node}")
        logger.debug(f"Running node {node.id}")

        await self.queue.put(self.__create_node_start(node.id))
        await self.progress.suspend()

        inputs = await self.__gather_inputs(node)

        await self.progress.suspend()

        output, execution_time = await self.loop.run_in_executor(
            self.pool,
            timed_supplier(functools.partial(run_node, node.data, inputs, node.id)),
        )
        await self.progress.suspend()

        if isinstance(output, RegularOutput):
            await self.__broadcast_data(node, execution_time, output.output)
        elif isinstance(output, IteratorOutput):
            await self.__broadcast_data(node, execution_time, output.partial_output)

        # Cache the output of the node
        if not isinstance(output, CollectorOutput):
            self.cache.set(node.id, output, self.cache_strategy[node.id])

        await self.progress.suspend()

        return output

    async def __broadcast_data(
        self,
        node: Node,
        execution_time: float,
        output: Output,
    ):
        self.completed_node_ids.add(node.id)

        async def send_broadcast():
            data, types = await self.loop.run_in_executor(
                self.pool, lambda: compute_broadcast(output, node.data.outputs)
            )
            await self.queue.put(
                {
                    "event": "node-finish",
                    "data": {
                        "nodeId": node.id,
                        "executionTime": execution_time,
                        "data": data,
                        "types": types,
                        "progressPercent": self.completed_percentage,
                    },
                }
            )

        # Only broadcast the output if the node has outputs and the output is not cached
        if (
            self.send_broadcast_data
            and len(node.data.outputs) > 0
            and not self.cache.has(node.id)
        ):
            # broadcasts are done is parallel, so don't wait
            self.__broadcast_tasks.append(self.loop.create_task(send_broadcast()))
        else:
            await self.queue.put(
                {
                    "event": "node-finish",
                    "data": {
                        "nodeId": node.id,
                        "executionTime": execution_time,
                        "data": None,
                        "types": None,
                        "progressPercent": self.completed_percentage,
                    },
                }
            )

    def __create_node_start(self, node_id: NodeId) -> Event:
        return {
            "event": "node-start",
            "data": {
                "nodeId": node_id,
            },
        }

    def __get_iterated_nodes(
        self, node: NewIteratorNode
    ) -> tuple[set[CollectorNode], set[FunctionNode], set[Node]]:
        """
        Returns all collector and output nodes iterated by the given iterator node
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
            elif isinstance(n, NewIteratorNode):
                raise ValueError("Nested iterators are not supported")
            else:
                assert isinstance(n, FunctionNode)

                if n.has_side_effects():
                    output_nodes.add(n)

                # follow edges
                for edge in self.chain.edges_from(n.id):
                    target_node = self.chain.nodes[edge.target.id]
                    visit(target_node)

        iterator_output = node.data.single_iterator_output
        for edge in self.chain.edges_from(node.id):
            # only follow iterator outputs
            if edge.source.output_id in iterator_output.outputs:
                target_node = self.chain.nodes[edge.target.id]
                visit(target_node)

        return collectors, output_nodes, seen

    def __iterator_fill_partial_output(
        self, node: NodeData, partial_output: Output, values: object
    ) -> Output:
        assert node.type == "newIterator"
        iterator_output = node.single_iterator_output

        values_list: list[object] = []
        if len(iterator_output.outputs) == 1:
            values_list.append(values)
        else:
            assert isinstance(values, (tuple, list))
            values_list.extend(values)

        assert len(values_list) == len(iterator_output.outputs)

        output: Output = partial_output.copy()
        for index, o in enumerate(node.outputs):
            if o.id in iterator_output.outputs:
                output[index] = o.enforce(values_list.pop(0))

        return output

    async def __process_iterator_node(self, node: NewIteratorNode):
        await self.progress.suspend()

        # run the iterator node itself before anything else
        iterator_output = await self.process(node.id)
        assert isinstance(iterator_output, IteratorOutput)

        collector_nodes, output_nodes, all_iterated_nodes = self.__get_iterated_nodes(
            node
        )
        all_iterated_nodes = {n.id for n in all_iterated_nodes}

        if len(collector_nodes) == 0 and len(output_nodes) == 0:
            # unusual, but this can happen
            # since we don't need to actually iterate the iterator, we can stop here
            return

        def fill_partial_output(values: object) -> RegularOutput:
            return RegularOutput(
                self.__iterator_fill_partial_output(
                    node.data, iterator_output.partial_output, values
                )
            )

        # run each of the collector nodes
        collectors: list[tuple[Collector, _Timer, CollectorNode]] = []
        for collector_node in collector_nodes:
            await self.progress.suspend()
            timer = _Timer()
            with timer.run():
                collector_output = await self.process(collector_node.id)
            assert isinstance(collector_output, CollectorOutput)
            collectors.append((collector_output.collector, timer, collector_node))

        # timing iterations
        times: list[float] = []
        expected_length = iterator_output.iterator.expected_length
        start_time = time.time()
        last_time = [start_time]

        async def update_progress():
            times.append(time.time() - last_time[0])
            iterations = len(times)
            last_time[0] = time.time()
            await self.__update_progress(
                node.id, times, iterations, max(expected_length, iterations)
            )

        # iterate
        await self.__update_progress(node.id, times, 0, expected_length)

        for values in iterator_output.iterator.iter_supplier():
            # write current values to cache
            iter_output = fill_partial_output(values)
            self.cache.set(node.id, iter_output, StaticCaching)

            # broadcast
            # TODO: Execution time. I just don't think any values makes sense here
            await self.__broadcast_data(node, 0, iter_output.output)

            # run each of the output nodes
            for output_node in output_nodes:
                await self.process(output_node.id)

            # run each of the collector nodes
            for collector, timer, collector_node in collectors:
                await self.progress.suspend()
                iterate_inputs = await self.__gather_collector_inputs(collector_node)
                await self.progress.suspend()
                with timer.run():
                    run_collector_iterate(collector_node, iterate_inputs, collector)

            # clear cache for next iteration
            self.cache.delete_many(all_iterated_nodes)

            await self.progress.suspend()
            await update_progress()
            await self.progress.suspend()

        # reset cached value
        self.cache.delete_many(all_iterated_nodes)
        self.cache.set(node.id, iterator_output, self.cache_strategy[node.id])

        # re-broadcast final value
        iterations = len(times)
        await self.__finish_progress(node.id, iterations)
        await self.__broadcast_data(
            node, time.time() - start_time, iterator_output.partial_output
        )

        # finalize collectors
        for collector, timer, collector_node in collectors:
            await self.progress.suspend()
            with timer.run():
                collector_output = enforce_output(
                    collector.on_complete(), collector_node.data
                )

            # TODO: execution time
            await self.__broadcast_data(
                collector_node, timer.duration, collector_output.output
            )

            self.cache.set(
                collector_node.id,
                collector_output,
                self.cache_strategy[collector_node.id],
            )

    async def __process_nodes(self):
        # we first need to run iterator nodes in topological order
        for node_id in self.chain.topological_order():
            node = self.chain.nodes[node_id]
            if isinstance(node, NewIteratorNode):
                await self.__process_iterator_node(node)

        # now the output nodes outside of iterators

        # Now run everything that is not in an iterator lineage
        non_iterator_output_nodes = [
            node
            for node, iter_node in self.chain.get_parent_iterator_map().items()
            if iter_node is None and node.has_side_effects()
        ]
        for output_node in non_iterator_output_nodes:
            await self.progress.suspend()
            await self.process(output_node.id)

        # clear cache after the chain is done
        self.cache.clear()

        # await all broadcasts
        tasks = self.__broadcast_tasks
        self.__broadcast_tasks = []
        for task in tasks:
            await task

    async def run(self):
        logger.debug(f"Running executor {self.execution_id}")
        try:
            await self.__process_nodes()
        finally:
            gc.collect()

    def __get_eta(self, times: list[float], index: int, total: int) -> float:
        if len(times) == 0:
            return 0
        return (sum(times) / len(times)) * (total - index)

    async def __update_progress(
        self, node_id: NodeId, times: list[float], index: int, length: int
    ):
        await self.queue.put(
            {
                "event": "node-progress-update",
                "data": {
                    "percent": index / length,
                    "index": index,
                    "total": length,
                    "eta": self.__get_eta(times, index, length),
                    "nodeId": node_id,
                },
            }
        )

    async def __finish_progress(self, node_id: NodeId, length: int):
        await self.queue.put(
            {
                "event": "node-progress-update",
                "data": {
                    "percent": 1,
                    "index": length,
                    "total": length,
                    "eta": 0,
                    "nodeId": node_id,
                },
            }
        )

    def resume(self):
        logger.debug(f"Resuming executor {self.execution_id}")
        self.progress.resume()

    def pause(self):
        logger.debug(f"Pausing executor {self.execution_id}")
        self.progress.pause()
        gc.collect()

    def kill(self):
        logger.debug(f"Killing executor {self.execution_id}")
        self.progress.abort()
