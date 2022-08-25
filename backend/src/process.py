from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
import functools
import uuid
import time
import numpy as np
from typing import Any, Callable, Dict, List, Optional, Tuple, TypedDict

from sanic.log import logger
from events import EventQueue, Event, InputsDict

from nodes.node_base import NodeBase
from nodes.node_factory import NodeFactory
from nodes.utils.image_utils import get_h_w_c


class CacheOptions(TypedDict):
    shouldCache: bool
    maxCacheHits: int


class UsableData(TypedDict):
    id: str
    schemaId: str
    inputs: list
    child: bool
    children: List[str]
    nodeType: str
    percent: float
    hasSideEffects: bool
    cacheOptions: CacheOptions


class NodeExecutionError(Exception):
    def __init__(
        self,
        node: UsableData,
        cause: str,
        inputs: InputsDict,
    ):
        super().__init__(cause)
        self.node: UsableData = node
        self.inputs: InputsDict = inputs


class ExecutionContext:
    def __init__(
        self,
        nodes: Dict[str, UsableData],
        loop: asyncio.AbstractEventLoop,
        queue: EventQueue,
        pool: ThreadPoolExecutor,
        cache: Dict[str, Any],
        iterator_id: str,
        executor: Executor,
        percent: float,
    ):
        self.nodes: Dict[str, UsableData] = nodes

        self.loop: asyncio.AbstractEventLoop = loop
        self.queue: EventQueue = queue
        self.pool: ThreadPoolExecutor = pool

        self.cache: Dict[str, Any] = cache
        self.iterator_id: str = iterator_id
        self.executor: Executor = executor
        self.percent: float = percent

    def create_iterator_executor(self) -> Executor:
        return Executor(
            self.nodes,
            self.loop,
            self.queue,
            self.pool,
            self.cache.copy(),
            self.executor,
        )


def timed_supplier(supplier: Callable[[], Any]) -> Callable[[], Tuple[Any, float]]:
    def wrapper():
        start = time.time()
        result = supplier()
        duration = time.time() - start
        return result, duration

    return wrapper


class Executor:
    """
    Class for executing chaiNNer's processing logic
    """

    def __init__(
        self,
        nodes: Dict[str, UsableData],
        loop: asyncio.AbstractEventLoop,
        queue: EventQueue,
        pool: ThreadPoolExecutor,
        existing_cache: Dict[str, Any],
        parent_executor: Optional[Executor] = None,
    ):
        self.execution_id: str = uuid.uuid4().hex
        self.nodes: Dict[str, UsableData] = nodes
        self.output_cache: Dict[str, Any] = existing_cache
        self.__broadcast_tasks: List[asyncio.Task[None]] = []
        self.cache_hit_state = {node["id"]: 0 for node in self.nodes.values()}

        self.killed: bool = False
        self.paused: bool = False
        self.resumed: bool = False

        self.loop: asyncio.AbstractEventLoop = loop
        self.queue: EventQueue = queue
        self.pool: ThreadPoolExecutor = pool

        self.parent_executor = parent_executor

    async def process(self, node: UsableData) -> Any:
        try:
            return await self.__process(node)
        except NodeExecutionError:
            raise
        except Exception as e:
            raise NodeExecutionError(node, str(e), {}) from e

    async def __process(self, node: UsableData) -> Any:
        """Process a single node"""
        logger.debug(f"node: {node}")
        node_id = node["id"]
        logger.debug(f"Running node {node_id}")
        # Return cached output value from an already-run node if that cached output exists
        if self.output_cache.get(node_id, None) is not None:
            await self.queue.put(self.__create_node_finish(node_id))
            temp = self.output_cache[node_id]
            self.cache_hit_state[node_id] += 1
            logger.info(
                f"Cache hit for node {node_id}: {self.cache_hit_state[node_id]}"
            )
            if (
                self.cache_hit_state[node_id] is not None
                and node["cacheOptions"]["maxCacheHits"] is not None
                and node["cacheOptions"]["maxCacheHits"] != "None"
                and self.cache_hit_state[node_id]
                >= node["cacheOptions"]["maxCacheHits"]
            ):
                logger.info(
                    f"number of cache hits exceeded: max: {node['cacheOptions']['maxCacheHits']}, current: {self.cache_hit_state[node_id]}"
                )
                logger.info("deleting cache entry for node: " + node_id)
                del self.output_cache[node_id]
            return temp

        inputs = []
        for node_input in node["inputs"]:
            if self.should_stop_running():
                return None
            # If input is a dict indicating another node, use that node's output value
            if isinstance(node_input, dict) and node_input.get("id", None):
                # Get the next node by id
                next_node_id = str(node_input["id"])
                next_input = self.nodes[next_node_id]
                next_index = int(node_input["index"])
                # Recursively get the value of the input
                processed_input = await self.process(next_input)
                # Split the output if necessary and grab the right index from the output
                if type(processed_input) in [list, tuple]:
                    index = next_index
                    processed_input = processed_input[index]
                inputs.append(processed_input)
                if self.should_stop_running():
                    return None
            # Otherwise, just use the given input (number, string, etc)
            else:
                inputs.append(node_input)
        if self.should_stop_running():
            return None
        # Create node based on given category/name information
        node_instance = NodeFactory.create_node(node["schemaId"])

        # Enforce that all inputs match the expected input schema
        enforced_inputs = []
        if node["nodeType"] == "iteratorHelper":
            enforced_inputs = inputs
        else:
            node_inputs = node_instance.get_inputs()
            for idx, node_input in enumerate(inputs):
                enforced_inputs.append(node_inputs[idx].enforce_(node_input))

        if node["nodeType"] == "iterator":
            logger.info("this is where an iterator would run")
            sub_nodes: Dict[str, UsableData] = {}
            for child in node["children"]:  # type: ignore
                sub_nodes[child] = self.nodes[child]
            sub_nodes_ids = sub_nodes.keys()
            for v in sub_nodes.copy().values():
                # TODO: this might be something to do in the frontend before processing instead
                for node_input in v["inputs"]:
                    logger.info(f"node_input, {node_input}")
                    if isinstance(node_input, dict) and node_input.get("id", None):
                        next_node_id = str(node_input["id"])
                        logger.info(f"next_node_id, {next_node_id}")
                        # Run all the connected nodes that are outside the iterator and cache the outputs
                        if next_node_id not in sub_nodes_ids:
                            logger.debug(f"not in sub_node_ids, caching {next_node_id}")
                            output = await self.process(self.nodes[next_node_id])
                            self.output_cache[next_node_id] = output
                            # Add this to the sub node dict as well so it knows it exists
                            sub_nodes[next_node_id] = self.nodes[next_node_id]
            context = ExecutionContext(
                sub_nodes,
                self.loop,
                self.queue,
                self.pool,
                self.output_cache,
                node["id"],
                self,
                node["percent"] if self.resumed else 0,
            )
            output = await node_instance.run(
                *enforced_inputs,
                context=context,  # type: ignore
            )
            # Cache the output of the node
            self.output_cache[node_id] = output
            await self.queue.put(self.__create_node_finish(node_id))
            del node_instance
            return output
        else:
            try:
                # Run the node and pass in inputs as args
                run_func = functools.partial(node_instance.run, *enforced_inputs)
                output, execution_time = await self.loop.run_in_executor(
                    self.pool, timed_supplier(run_func)
                )
            except NodeExecutionError:
                raise
            except Exception as e:
                input_dict: InputsDict = {}
                for index, node_input in enumerate(node_instance.get_inputs()):
                    input_id = index if node_input.id is None else node_input.id
                    input_value = enforced_inputs[index]
                    if input_value is None:
                        input_dict[input_id] = None
                    elif isinstance(input_value, (str, int, float)):
                        input_dict[input_id] = input_value
                    elif isinstance(input_value, np.ndarray):
                        h, w, c = get_h_w_c(input_value)
                        input_dict[input_id] = {"width": w, "height": h, "channels": c}
                raise NodeExecutionError(node, str(e), input_dict) from e

            await self.__broadcast_data(node_instance, node_id, execution_time, output)
            # Cache the output of the node
            if node["cacheOptions"]["shouldCache"]:
                self.output_cache[node_id] = output
            del node_instance, run_func
            return output

    async def __broadcast_data(
        self,
        node_instance: NodeBase,
        node_id: str,
        execution_time: float,
        output: Any,
    ):
        node_outputs = node_instance.get_outputs()
        finished = [key for key in self.output_cache.keys()]
        if not node_id in finished:
            finished.append(node_id)

        def compute_broadcast_data():
            broadcast_data: Dict[int, Any] = dict()
            output_list: List[Any] = [output] if len(node_outputs) == 1 else output
            for index, node_output in enumerate(node_outputs):
                try:
                    output_id = node_output.id if node_output.id is not None else index
                    broadcast_data[output_id] = node_output.get_broadcast_data(
                        output_list[index]
                    )
                except Exception as e:
                    logger.error(f"Error broadcasting output: {e}")
            return broadcast_data

        async def send_broadcast():
            data = await self.loop.run_in_executor(self.pool, compute_broadcast_data)
            await self.queue.put(
                {
                    "event": "node-finish",
                    "data": {
                        "finished": finished,
                        "nodeId": node_id,
                        "executionTime": execution_time,
                        "data": data,
                    },
                }
            )

        # Only broadcast the output if the node has outputs and the output is not cached
        if len(node_outputs) > 0 and self.output_cache.get(node_id, None) is None:
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
                    },
                }
            )

    def __create_node_finish(self, node_id: str) -> Event:
        finished = [key for key in self.output_cache.keys()]
        if not node_id in finished:
            finished.append(node_id)

        return {
            "event": "node-finish",
            "data": {
                "finished": finished,
                "nodeId": node_id,
                "executionTime": None,
                "data": None,
            },
        }

    def get_output_nodes(self) -> List[UsableData]:
        output_nodes: List[UsableData] = []
        for node in self.nodes.values():
            if (node["hasSideEffects"]) and not node["child"]:
                output_nodes.append(node)
        return output_nodes

    async def process_nodes(self):
        if self.killed:
            return

        # Run each of the output nodes through processing
        for output_node in self.get_output_nodes():
            if self.killed:
                break
            await self.process(output_node)

        # await all broadcasts
        tasks = self.__broadcast_tasks
        self.__broadcast_tasks = []
        for task in tasks:
            await task

    async def run(self):
        """Run the executor"""
        logger.debug(f"Running executor {self.execution_id}")
        await self.process_nodes()

    async def resume(self):
        """Run the executor"""
        logger.info(f"Resuming executor {self.execution_id}")
        self.paused = False
        self.resumed = True
        await self.process_nodes()

    async def pause(self):
        """Pause the executor"""
        logger.info(f"Pausing executor {self.execution_id}")
        self.paused = True

    async def kill(self):
        """Kill the executor"""
        logger.info(f"Killing executor {self.execution_id}")
        self.killed = True

    def is_killed(self):
        """Return if the executor is killed"""
        return self.killed

    def is_paused(self):
        """Return if the executor is paused"""
        return self.paused

    def should_stop_running(self):
        """Return if the executor should stop running"""
        return (
            self.killed
            or self.paused
            or (self.parent_executor is not None and self.parent_executor.is_killed())
            or (self.parent_executor is not None and self.parent_executor.is_paused())
        )
