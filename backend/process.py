import asyncio
import functools
import uuid
from typing import Dict, List

from sanic import app
from sanic.log import logger

from nodes.node_factory import NodeFactory


class Executor:
    def __init__(
        self, nodes: List[Dict], loop, queue: asyncio.Queue, existing_cache: Dict
    ):
        """Constructor"""
        self.execution_id = uuid.uuid4().hex
        self.nodes = nodes
        self.output_cache = existing_cache

        self.process_task = None
        self.killed = False
        self.paused = False

        self.loop = loop
        self.queue = queue

    async def process(self, node: Dict):
        """Process a single node"""
        node_id = node["id"]
        logger.info(f"Running node {node_id}")
        # Return cached output value from an already-run node if that cached output exists
        if self.output_cache.get(node_id, None) is not None:
            return self.output_cache[node_id]

        inputs = []
        for node_input in node["inputs"]:
            if self.killed or self.paused:
                return None
            # If input is a dict indicating another node, use that node's output value
            if isinstance(node_input, dict) and node_input.get("id", None):
                # Get the next node by id
                next_node_id = "-".join(node_input["id"].split("-")[:-1])
                next_input = self.nodes[next_node_id]
                next_index = int(node_input["id"].split("-")[-1])
                # Recursively get the value of the input
                processed_input = await self.process(next_input)
                # Split the output if necessary and grab the right index from the output
                if type(processed_input) in [list, tuple]:
                    index = next_index  # next_input["outputs"].index({"id": node_id})
                    processed_input = processed_input[index]
                inputs.append(processed_input)
                if self.killed or self.paused:
                    return None
            # Otherwise, just use the given input (number, string, etc)
            else:
                inputs.append(node_input)
        if self.killed or self.paused:
            return None
        # Create node based on given category/name information
        node_instance = NodeFactory.create_node(node["category"], node["node"])
        # Run the node and pass in inputs as args
        run_func = functools.partial(node_instance.run, *inputs)
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
            if node["outputs"] is None or len(node["outputs"]) == 0:
                output_nodes.append(node)
        # Run each of the output nodes through processing
        for output_node in output_nodes:
            if self.killed:
                break
            await self.process(output_node)

    async def run(self):
        """Run the executor"""
        logger.info(f"Running executor {self.execution_id}")
        self.paused = False
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
