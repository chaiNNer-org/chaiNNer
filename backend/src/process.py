from __future__ import annotations

import asyncio
import functools
import gc
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Iterable, List, Optional, Set

from sanic.log import logger

from api import Collector, Iterator, NodeData
from base_types import NodeId, OutputId
from chain.cache import CacheStrategy, OutputCache, get_cache_strategies
from chain.chain import Chain, CollectorNode, NewIteratorNode, Node
from chain.input import EdgeInput, InputMap
from events import Event, EventQueue, InputsDict
from nodes.base_output import BaseOutput
from progress_controller import Aborted, ProgressController
from util import timed_supplier

Output = List[object]


def collect_input_information(
    node: NodeData,
    inputs: List[object],
    enforced: bool = True,
) -> InputsDict:
    try:
        input_dict: InputsDict = {}

        for value, node_input in zip(inputs, node.inputs):
            if not enforced:
                try:
                    value = node_input.enforce_(value)
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
        logger.error(f"Error collecting input information.", outer_e)
        return {}


def enforce_inputs(
    inputs: Iterable[object], node: NodeData, node_id: NodeId
) -> List[object]:
    inputs = list(inputs)

    try:
        enforced_inputs: List[object] = []
        for index, value in enumerate(inputs):
            enforced_inputs.append(node.inputs[index].enforce_(value))
        return enforced_inputs
    except Exception as e:
        input_dict = collect_input_information(node, inputs, enforced=False)
        raise NodeExecutionError(node_id, node, str(e), input_dict) from e


def enforce_output(raw_output: object, node: NodeData) -> Output:
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

    return output


def run_node(
    node: NodeData, inputs: List[object], node_id: NodeId
) -> Output | Iterator | Collector:
    assert (
        node.type == "regularNode"
        or node.type == "newIterator"
        or node.type == "collector"
    )

    enforced_inputs = []
    if node.type != "collector":
        enforced_inputs = enforce_inputs(inputs, node, node_id)
    try:
        if node.type != "collector":
            raw_output = node.run(*enforced_inputs)
        else:
            raw_output = node.run(*list(inputs))
        if node.type == "newIterator":
            assert isinstance(raw_output, Iterator)
            return raw_output
        if node.type == "collector":
            assert isinstance(raw_output, Collector)
            return raw_output
        return enforce_output(raw_output, node)
    except Aborted:
        raise
    except NodeExecutionError:
        raise
    except Exception as e:
        # collect information to provide good error messages
        if node.type != "collector":
            input_dict = collect_input_information(node, enforced_inputs)
        else:
            input_dict = collect_input_information(node, list(inputs))
        raise NodeExecutionError(node_id, node, str(e), input_dict) from e


def compute_broadcast(output: Output, node_outputs: Iterable[BaseOutput]):
    data: Dict[OutputId, object] = dict()
    types: Dict[OutputId, object] = dict()
    for index, node_output in enumerate(node_outputs):
        try:
            data[node_output.id] = node_output.get_broadcast_data(output[index])
            types[node_output.id] = node_output.get_broadcast_type(output[index])
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
        parent_cache: Optional[OutputCache[Output]] = None,
    ):
        self.execution_id: str = uuid.uuid4().hex
        self.chain = chain
        self.inputs = inputs
        self.send_broadcast_data: bool = send_broadcast_data
        self.cache: OutputCache[Output] = OutputCache(parent=parent_cache)
        self.collector_cache: Dict[NodeId, Collector] = {}
        self.__broadcast_tasks: List[asyncio.Task[None]] = []

        self.progress = ProgressController()

        self.completed_node_ids = set()

        self.loop: asyncio.AbstractEventLoop = loop
        self.queue: EventQueue = queue
        self.pool: ThreadPoolExecutor = pool

        self.cache_strategy: Dict[NodeId, CacheStrategy] = get_cache_strategies(chain)

    async def process(self, node_id: NodeId) -> Output | Iterator:
        node = self.chain.nodes[node_id]
        try:
            return await self.__process(node)
        except Aborted:
            raise
        except NodeExecutionError:
            raise
        except Exception as e:
            raise NodeExecutionError(node.id, node.get_node(), str(e), {}) from e

    async def __process(self, node: Node) -> Output | Iterator:
        """Process a single node"""

        # Return cached output value from an already-run node if that cached output exists
        cached = self.cache.get(node.id)
        if cached is not None:
            if not node.id in self.completed_node_ids:
                self.completed_node_ids.add(node.id)
                await self.queue.put(self.__create_node_finish(node.id))
            return cached

        logger.debug(f"node: {node}")
        logger.debug(f"Running node {node.id}")

        await self.queue.put(self.__create_node_start(node.id))

        await self.progress.suspend()

        inputs = []
        for node_input in self.inputs.get(node.id):
            # If input is a dict indicating another node, use that node's output value
            if isinstance(node_input, EdgeInput):
                # Recursively get the value of the input
                processed_input = await self.process(node_input.id)
                assert not isinstance(processed_input, Iterator)
                assert not isinstance(processed_input, Collector)
                inputs.append(processed_input[node_input.index])
            # Otherwise, just use the given input (number, string, etc)
            else:
                inputs.append(node_input.value)

        await self.progress.suspend()

        # Create node based on given category/name information
        node_instance = node.get_node()

        if node_instance.type == "newIterator":
            output, execution_time = await self.loop.run_in_executor(
                self.pool,
                timed_supplier(
                    functools.partial(run_node, node_instance, inputs, node.id)
                ),
            )
            assert isinstance(output, Iterator)

            await self.progress.suspend()
        elif node_instance.type == "collector":
            collector_node = self.collector_cache[node.id]
            collector_node.on_iterate(inputs)
            output = None

            await self.progress.suspend()
        else:
            output, execution_time = await self.loop.run_in_executor(
                self.pool,
                timed_supplier(
                    functools.partial(run_node, node_instance, inputs, node.id)
                ),
            )

            await self.progress.suspend()
            await self.__broadcast_data(node_instance, node.id, execution_time, output)  # type: ignore

        # Cache the output of the node
        # If we are executing a free node from within an iterator,
        # we want to store the result in the cache of the parent executor
        if node.get_node().type != "collector":
            write_cache = self.cache
            write_cache.set(node.id, output, self.cache_strategy[node.id])  # type: ignore

        return output  # type: ignore

    async def __broadcast_data(
        self,
        node_instance: NodeData,
        node_id: NodeId,
        execution_time: float,
        output: Output,
    ):
        finished = self.cache.keys()
        finished.add(node_id)
        finished = list(finished)

        self.completed_node_ids.add(node_id)

        async def send_broadcast():
            data, types = await self.loop.run_in_executor(
                self.pool, lambda: compute_broadcast(output, node_instance.outputs)
            )
            await self.queue.put(
                {
                    "event": "node-finish",
                    "data": {
                        "nodeId": node_id,
                        "executionTime": execution_time,
                        "data": data,
                        "types": types,
                        "progressPercent": len(self.completed_node_ids)
                        / len(self.chain.nodes),
                    },
                }
            )

        # Only broadcast the output if the node has outputs and the output is not cached
        if (
            self.send_broadcast_data
            and len(node_instance.outputs) > 0
            and not self.cache.has(node_id)
        ):
            # broadcasts are done is parallel, so don't wait
            self.__broadcast_tasks.append(self.loop.create_task(send_broadcast()))
        else:
            await self.queue.put(
                {
                    "event": "node-finish",
                    "data": {
                        "nodeId": node_id,
                        "executionTime": execution_time,
                        "data": None,
                        "types": None,
                        "progressPercent": len(self.completed_node_ids)
                        / len(self.chain.nodes),
                    },
                }
            )

    def __create_node_finish(self, node_id: NodeId) -> Event:
        finished = self.cache.keys()
        finished.add(node_id)
        finished = list(finished)

        self.completed_node_ids.add(node_id)

        return {
            "event": "node-finish",
            "data": {
                "nodeId": node_id,
                "executionTime": None,
                "data": None,
                "types": None,
                "progressPercent": len(self.completed_node_ids) / len(self.chain.nodes),
            },
        }

    def __create_node_start(self, node_id: NodeId) -> Event:
        return {
            "event": "node-start",
            "data": {
                "nodeId": node_id,
            },
        }

    def __get_output_nodes(self) -> List[NodeId]:
        output_nodes: List[NodeId] = []
        for node in self.chain.nodes.values():
            side_effects = node.has_side_effects()
            if side_effects:
                output_nodes.append(node.id)
        return output_nodes

    def __get_iterator_nodes(self) -> List[NodeId]:
        iterator_nodes: List[NodeId] = []
        for node in self.chain.nodes.values():
            if isinstance(node, NewIteratorNode):
                iterator_nodes.append(node.id)
        return iterator_nodes

    def __get_collector_nodes(self) -> List[NodeId]:
        collector_nodes: List[NodeId] = []
        for node in self.chain.nodes.values():
            if isinstance(node, CollectorNode):
                collector_nodes.append(node.id)
        return collector_nodes

    def __get_downstream_nodes(self, node: NodeId) -> Set[NodeId]:
        downstream_nodes: List[NodeId] = []
        for edge in self.chain.edges_from(node):
            downstream_nodes.append(edge.target.id)
        for downstream_node in downstream_nodes:
            downstream_nodes.extend(self.__get_downstream_nodes(downstream_node))
        return set(downstream_nodes)

    def __get_upstream_nodes(self, node: NodeId) -> Set[NodeId]:
        upstream_nodes: List[NodeId] = []
        for edge in self.chain.edges_to(node):
            upstream_nodes.append(edge.source.id)
        for upstream_node in upstream_nodes:
            upstream_nodes.extend(self.__get_upstream_nodes(upstream_node))
        return set(upstream_nodes)

    async def __process_nodes(self):
        await self.progress.suspend()

        iterator_node_set = set()
        chain_output_nodes = self.__get_output_nodes()

        collector_nodes = self.__get_collector_nodes()
        self.collector_cache: Dict[NodeId, Collector] = {}
        collector_downstreams = set()

        # Run each of the collector nodes first. This gives us all the collector objects that we will use when iterating
        for collector_node in collector_nodes:
            inputs = []
            for collector_input in self.inputs.get(collector_node):
                # If input is a dict indicating another node, use that node's output value
                if isinstance(collector_input, EdgeInput):
                    # We can't use connections for collectors in case the connection is to an iterator
                    inputs.append(None)
                else:
                    inputs.append(collector_input.value)
            node_instance = self.chain.nodes[collector_node].get_node()
            collector_output, execution_time = await self.loop.run_in_executor(
                self.pool,
                timed_supplier(
                    functools.partial(run_node, node_instance, inputs, collector_node)
                ),
            )
            assert isinstance(collector_output, Collector)
            self.collector_cache[collector_node] = collector_output
            # Anything downstream from the collector we don't want to run yet, so we keep track of them here
            downstream_from_collector = self.__get_downstream_nodes(collector_node)
            collector_downstreams.update(downstream_from_collector)

        before_iteration_time = time.time()

        # Now run each of the iterators
        for iterator_node in self.__get_iterator_nodes():
            # Get all downstream nodes of the iterator
            # This excludes any nodes that are downstream of a collector, as well as collectors themselves
            downstream_nodes = [
                x
                for x in self.__get_downstream_nodes(iterator_node)
                if x not in collector_downstreams and x not in collector_nodes
            ]
            output_nodes = [x for x in chain_output_nodes if x in downstream_nodes]
            upstream_nodes = [self.__get_upstream_nodes(x) for x in output_nodes]
            flat_upstream_nodes = set()
            for x in upstream_nodes:
                flat_upstream_nodes.update(x)
            combined_subchain = flat_upstream_nodes.union(downstream_nodes)
            iterator_node_set = iterator_node_set.union(combined_subchain)

            node_instance = self.chain.nodes[iterator_node].get_node()
            assert node_instance.type == "newIterator"

            self.cache.set(iterator_node, None, CacheStrategy(0))  # type: ignore

            iter_result = await self.process(iterator_node)

            assert isinstance(iter_result, Iterator)

            num_outgoers = len(self.chain.edges_from(iterator_node))

            start_time = time.time()
            last_time = start_time
            times: List[float] = []
            enforced_values = None
            for index, values in enumerate(iter_result.iter_supplier()):
                await self.queue.put(self.__create_node_start(iterator_node))

                self.cache.delete_many(downstream_nodes)
                enforced_values = enforce_output(
                    values, self.chain.nodes[iterator_node].get_node()
                )

                after_time = time.time()
                execution_time = after_time - last_time
                times.append(execution_time)
                await self.__broadcast_data(
                    node_instance, iterator_node, execution_time, enforced_values
                )
                await self.__update_progress(
                    iterator_node, times, index, iter_result.expected_length
                )
                last_time = after_time

                # Set the cache to the value of the generator, so that downstream nodes will pull from that
                self.cache.set(
                    iterator_node, enforced_values, CacheStrategy(num_outgoers)
                )
                # Run each of the collector nodes
                for collector_node in collector_nodes:
                    await self.progress.suspend()
                    await self.process(collector_node)
                # Run each of the output nodes
                for output_node in output_nodes:
                    await self.progress.suspend()
                    await self.process(output_node)

                logger.debug(self.cache.keys())
            end_time = time.time()
            execution_time = end_time - start_time
            if enforced_values is not None:
                await self.__broadcast_data(
                    node_instance, iterator_node, execution_time, enforced_values
                )
            await self.__finish_progress(iterator_node, iter_result.expected_length)

        # Complete each of the collector nodes, and cache their values
        for collector_node in collector_nodes:
            collector_result = self.collector_cache[collector_node].on_complete()
            enforced_values = enforce_output(
                collector_result, self.chain.nodes[collector_node].get_node()
            )
            self.cache.set(
                collector_node,
                enforced_values,
                CacheStrategy(len(self.chain.edges_from(collector_node))),
            )
            collector_time = time.time() - before_iteration_time
            await self.__broadcast_data(
                self.chain.nodes[collector_node].get_node(),
                collector_node,
                collector_time,
                enforced_values,
            )

        # Now run everything downstream of the collectors
        collector_downstream_outputs = [
            x for x in chain_output_nodes if x in collector_downstreams
        ]
        for output_node in collector_downstream_outputs:
            await self.progress.suspend()
            await self.process(output_node)

        iterator_node_set.update(collector_nodes)
        iterator_node_set.update(collector_downstreams)

        # Now run everything that is not in an iterator lineage
        without_iterator_lineage = [
            x for x in self.chain.nodes.values() if x not in iterator_node_set
        ]

        self.cache.clear()

        if len(without_iterator_lineage) > 0:
            non_iterator_output_nodes = [
                x for x in chain_output_nodes if x not in iterator_node_set
            ]
            for output_node in non_iterator_output_nodes:
                await self.progress.suspend()
                await self.process(output_node)

        logger.debug(self.cache.keys())

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

    def __get_eta(self, times: List[float], index: int, total: int) -> float:
        if len(times) == 0:
            return 0
        return (sum(times) / len(times)) * (total - index)

    async def __update_progress(
        self, node_id: NodeId, times: List[float], index: int, length: int
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
