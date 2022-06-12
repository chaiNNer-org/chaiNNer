from __future__ import annotations

import asyncio
import functools
import os
import uuid
from typing import Any, Dict

from sanic.log import logger

from nodes.node_factory import NodeFactory


class Executor:
    """
    Class for executing chaiNNer's processing logic
    """

    def __init__(
        self,
        nodes: Dict,
        loop,
        queue: asyncio.Queue,
        existing_cache: Dict,
        parent_executor=None,
    ):
        """Constructor"""
        self.execution_id = uuid.uuid4().hex
        self.nodes = nodes
        self.output_cache = existing_cache

        self.process_task = None
        self.killed = False
        self.paused = False
        self.resumed = False

        self.loop = loop
        self.queue = queue

        self.parent_executor = parent_executor

    async def process(self, node: Dict) -> Any:
        """Process a single node"""
        logger.debug(f"node: {node}")
        node_id = node["id"]
        logger.debug(f"Running node {node_id}")
        # Return cached output value from an already-run node if that cached output exists
        if self.output_cache.get(node_id, None) is not None:
            finish_data = await self.check()
            await self.queue.put({"event": "node-finish", "data": finish_data})
            return self.output_cache[node_id]

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
                    index = next_index  # next_input["outputs"].index({"id": node_id})
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
                # TODO: remove this when all the inputs are transitioned to classes
                if isinstance(node_inputs[idx], dict):
                    enforced_inputs.append(node_input)
                else:
                    enforced_inputs.append(node_inputs[idx].enforce_(node_input))

        if node["nodeType"] == "iterator":
            logger.info("this is where an iterator would run")
            sub_nodes = {}
            for child in node["children"]:
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
            output = await node_instance.run(
                *enforced_inputs,
                nodes=sub_nodes,  # type: ignore
                loop=self.loop,  # type: ignore
                queue=self.queue,  # type: ignore
                external_cache=self.output_cache,  # type: ignore
                iterator_id=node["id"],  # type: ignore
                parent_executor=self,  # type: ignore
                percent=node["percent"] if self.resumed else 0,  # type: ignore
            )
            # Cache the output of the node
            self.output_cache[node_id] = output
            finish_data = await self.check()
            await self.queue.put({"event": "node-finish", "data": finish_data})
            del node_instance, finish_data
            return output
        else:
            # Run the node and pass in inputs as args
            run_func = functools.partial(node_instance.run, *enforced_inputs)
            output = await self.loop.run_in_executor(None, run_func)
            # Cache the output of the node
            self.output_cache[node_id] = output
            finish_data = await self.check()
            await self.queue.put({"event": "node-finish", "data": finish_data})
            del node_instance, run_func, finish_data
            return output

    async def process_nodes(self):
        # Create a list of all output nodes
        output_nodes = []
        for node in self.nodes.values():
            if self.killed:
                break
            print(node["hasSideEffects"])
            if (node["hasSideEffects"]) and not node["child"]:
                output_nodes.append(node)
        # Run each of the output nodes through processing
        for output_node in output_nodes:
            if self.killed:
                break
            await self.process(output_node)

    async def run(self):
        """Run the executor"""
        logger.debug(f"Running executor {self.execution_id}")
        await self.process_nodes()

    async def resume(self):
        """Run the executor"""
        logger.info(f"Resuming executor {self.execution_id}")
        self.paused = False
        self.resumed = True
        os.environ["killed"] = "False"
        await self.process_nodes()

    async def check(self):
        """Check the executor"""
        cached_ids = [key for key in self.output_cache.keys()]
        return {
            "finished": cached_ids,
        }

    async def pause(self):
        """Pause the executor"""
        logger.info(f"Pausing executor {self.execution_id}")
        self.paused = True

    async def kill(self):
        """Kill the executor"""
        logger.info(f"Killing executor {self.execution_id}")
        self.killed = True
        os.environ["killed"] = "True"

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
