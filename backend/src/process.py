from __future__ import annotations

import asyncio
import functools
import gc
import time
import uuid
from collections.abc import Awaitable
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Dict, Iterable, List, Literal, Optional, Tuple, TypeVar

import numpy as np
from sanic.log import logger

from api import NodeData
from base_types import NodeId, OutputId
from chain.cache import CacheStrategy, OutputCache, get_cache_strategies
from chain.chain import Chain, FunctionNode, IteratorNode, Node, SubChain
from chain.input import EdgeInput, InputMap
from events import Event, EventQueue, InputsDict
from nodes.impl.image_utils import get_h_w_c
from nodes.properties.outputs.base_output import BaseOutput
from progress_controller import Aborted, ProgressController, ProgressToken

Output = List[object]


def enforce_inputs(inputs: Iterable[object], node: NodeData) -> List[object]:
    if node.type == "iteratorHelper":
        return list(inputs)

    enforced_inputs: List[object] = []
    for index, value in enumerate(inputs):
        enforced_inputs.append(node.inputs[index].enforce_(value))
    return enforced_inputs


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

    # make outputs readonly
    for o in output:
        if isinstance(o, np.ndarray):
            o.setflags(write=False)

    # output-specific validations
    for i, o in enumerate(node.outputs):
        output[i] = o.enforce(output[i])

    return output


def run_node(node: NodeData, inputs: Iterable[object], node_id: NodeId) -> Output:
    assert node.type == "regularNode" or node.type == "iteratorHelper"

    enforced_inputs = enforce_inputs(inputs, node)
    try:
        raw_output = node.run(*enforced_inputs)
        return enforce_output(raw_output, node)
    except Aborted:
        raise
    except NodeExecutionError:
        raise
    except Exception as e:
        # collect information to provide good error messages
        input_dict: InputsDict = {}
        for index, node_input in enumerate(node.inputs):
            input_id = node_input.id
            input_value = enforced_inputs[index]
            if input_value is None:
                input_dict[input_id] = None
            elif isinstance(input_value, (str, int, float)):
                input_dict[input_id] = input_value
            elif isinstance(input_value, np.ndarray):
                h, w, c = get_h_w_c(input_value)
                input_dict[input_id] = {"width": w, "height": h, "channels": c}

        raise NodeExecutionError(node_id, node, str(e), input_dict) from e


async def run_iterator_node(
    node: NodeData,
    inputs: Iterable[object],
    context: IteratorContext,
) -> Output:
    assert node.type == "iterator"

    raw_output = await node.run(*enforce_inputs(inputs, node), context=context)
    return enforce_output(raw_output, node)


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


T = TypeVar("T")


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


class IteratorContext:
    def __init__(
        self,
        executor: Executor,
        iterator_id: NodeId,
    ):
        self.executor: Executor = executor
        self.progress: ProgressToken = executor.progress
        self.times: List[float] = []

        self.iterator_id: NodeId = iterator_id
        self.chain = SubChain(executor.chain, iterator_id)
        self.inputs = InputMap(parent=executor.inputs)

    def get_helper(self, schema_id: str) -> FunctionNode:
        for node in self.chain.nodes.values():
            if node.schema_id == schema_id:
                return node
        assert (
            False
        ), f"Unable to find {schema_id} helper node for iterator {self.iterator_id}"

    def __create_iterator_executor(self) -> Executor:
        return Executor(
            self.executor.chain,
            self.inputs,
            self.executor.send_broadcast_data,
            self.executor.loop,
            self.executor.queue,
            self.executor.pool,
            parent_executor=self.executor,
        )

    def __get_eta(self, index: int, total: int) -> float:
        if len(self.times) == 0:
            return 0
        return (sum(self.times) / len(self.times)) * (total - index)

    async def __update_progress(self, index: int, length: int):
        await self.executor.queue.put(
            {
                "event": "iterator-progress-update",
                "data": {
                    "percent": index / length,
                    "index": index,
                    "total": length,
                    "eta": self.__get_eta(index, length),
                    "iteratorId": self.iterator_id,
                    "running": list(self.chain.nodes.keys()),
                },
            }
        )

    async def __finish_progress(self, length: int):
        await self.executor.queue.put(
            {
                "event": "iterator-progress-update",
                "data": {
                    "percent": 1,
                    "index": length,
                    "total": length,
                    "eta": 0,
                    "iteratorId": self.iterator_id,
                    "running": None,
                },
            }
        )

    async def run_iteration(self, index: int, total: int):
        await self.__update_progress(index, total)
        await self.progress.suspend()

        start = time.time()
        try:
            executor = self.__create_iterator_executor()
            await executor.run_iteration(self.chain)
        finally:
            end = time.time()
            self.times.append(end - start)

    async def run(
        self,
        collection: Iterable[T],
        before: Callable[[T, int], None | Literal[False]],
    ):
        items = list(collection)
        length = len(items)

        await self.__update_progress(0, length)

        errors: List[str] = []
        for index, item in enumerate(items):
            try:
                await self.progress.suspend()

                result = before(item, index)
                if result is False:
                    break

                await self.run_iteration(index, length)
            except Aborted:
                raise
            except Exception as e:
                logger.error(e)
                errors.append(str(e))

        await self.__finish_progress(length)

        if len(errors) > 0:
            raise RuntimeError(
                # pylint: disable=consider-using-f-string
                "Errors occurred during iteration: \n• {}".format("\n• ".join(errors))
            )

    async def run_while(
        self,
        length_estimate: int,
        before: Callable[[int], None | Literal[False]],
        fail_fast=False,
    ):
        errors: List[str] = []
        index = -1

        await self.__update_progress(0, length_estimate)

        while True:
            try:
                await self.progress.suspend()

                index += 1

                result = before(index)
                if result is False:
                    break

                await self.run_iteration(index, max(length_estimate, index + 1))
            except Aborted:
                raise
            except Exception as e:
                logger.error(e)
                if fail_fast:
                    raise
                errors.append(str(e))

        await self.__finish_progress(index)

        if len(errors) > 0:
            raise RuntimeError(
                # pylint: disable=consider-using-f-string
                "Errors occurred during iteration: \n• {}".format("\n• ".join(errors))
            )


def timed_supplier(supplier: Callable[[], T]) -> Callable[[], Tuple[T, float]]:
    def wrapper():
        start = time.time()
        result = supplier()
        duration = time.time() - start
        return result, duration

    return wrapper


async def timed_supplier_async(supplier: Callable[[], Awaitable[T]]) -> Tuple[T, float]:
    start = time.time()
    result = await supplier()
    duration = time.time() - start
    return result, duration


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
        parent_executor: Optional[Executor] = None,
    ):
        assert not (
            parent_cache and parent_executor
        ), "Providing both a parent executor and a parent cache is not supported."

        self.execution_id: str = uuid.uuid4().hex
        self.chain = chain
        self.inputs = inputs
        self.send_broadcast_data: bool = send_broadcast_data
        self.cache: OutputCache[Output] = OutputCache(
            parent=parent_executor.cache if parent_executor else parent_cache
        )
        self.__broadcast_tasks: List[asyncio.Task[None]] = []

        self.progress = (
            ProgressController() if not parent_executor else parent_executor.progress
        )

        self.completed_node_ids = set()

        self.loop: asyncio.AbstractEventLoop = loop
        self.queue: EventQueue = queue
        self.pool: ThreadPoolExecutor = pool

        self.parent_executor = parent_executor

        self.cache_strategy: Dict[NodeId, CacheStrategy] = (
            parent_executor.cache_strategy
            if parent_executor
            else get_cache_strategies(chain)
        )

    async def process(self, node_id: NodeId) -> Output:
        node = self.chain.nodes[node_id]
        try:
            return await self.__process(node)
        except Aborted:
            raise
        except NodeExecutionError:
            raise
        except Exception as e:
            raise NodeExecutionError(node.id, node.get_node(), str(e), {}) from e

    async def __process(self, node: Node) -> Output:
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

        await self.progress.suspend()

        inputs = []
        for node_input in self.inputs.get(node.id):
            # If input is a dict indicating another node, use that node's output value
            if isinstance(node_input, EdgeInput):
                # Recursively get the value of the input
                processed_input = await self.process(node_input.id)
                # Grab the right index from the output
                inputs.append(processed_input[node_input.index])
            # Otherwise, just use the given input (number, string, etc)
            else:
                inputs.append(node_input.value)

        await self.progress.suspend()

        # Create node based on given category/name information
        node_instance = node.get_node()

        if node_instance.type == "iterator":
            output, execution_time = await timed_supplier_async(
                functools.partial(
                    run_iterator_node,
                    node_instance,
                    inputs,
                    IteratorContext(self, node.id),
                )
            )

            await self.progress.suspend()
            await self.__broadcast_data(node_instance, node.id, execution_time, output)
        else:
            output, execution_time = await self.loop.run_in_executor(
                self.pool,
                timed_supplier(
                    functools.partial(run_node, node_instance, inputs, node.id)
                ),
            )

            await self.progress.suspend()
            await self.__broadcast_data(node_instance, node.id, execution_time, output)

        # Cache the output of the node
        # If we are executing a free node from within an iterator,
        # we want to store the result in the cache of the parent executor
        write_cache = (
            self.parent_executor.cache
            if self.parent_executor and node.parent is None
            else self.cache
        )
        write_cache.set(node.id, output, self.cache_strategy[node.id])

        return output

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
                        "finished": finished,
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
                        "finished": finished,
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
                "finished": finished,
                "nodeId": node_id,
                "executionTime": None,
                "data": None,
                "types": None,
                "progressPercent": len(self.completed_node_ids) / len(self.chain.nodes),
            },
        }

    def __get_output_nodes(self) -> List[NodeId]:
        output_nodes: List[NodeId] = []
        for node in self.chain.nodes.values():
            # we assume that iterator node always have side effects
            side_effects = isinstance(node, IteratorNode) or node.has_side_effects()
            if node.parent is None and side_effects:
                output_nodes.append(node.id)
        return output_nodes

    def __get_iterator_output_nodes(self, sub: SubChain) -> List[NodeId]:
        output_nodes: List[NodeId] = []
        for node in sub.nodes.values():
            if node.has_side_effects():
                output_nodes.append(node.id)
        return output_nodes

    async def __process_nodes(self, nodes: List[NodeId]):
        await self.progress.suspend()

        # Run each of the output nodes through processing
        for output_node in nodes:
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
            await self.__process_nodes(self.__get_output_nodes())
        finally:
            gc.collect()

    async def run_iteration(self, sub: SubChain):
        logger.debug(f"Running executor {self.execution_id}")
        await self.__process_nodes(self.__get_iterator_output_nodes(sub))

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
