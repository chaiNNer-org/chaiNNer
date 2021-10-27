import uuid
from typing import Dict, List

from sanic.log import logger

from nodes.node_factory import NodeFactory


class Executor:
    def __init__(self, nodes: List[Dict]):
        """Constructor"""
        self.execution_id = uuid.uuid4().hex
        self.nodes = nodes
        self.output_cache = {}

    def process(self, node: Dict):
        """Process a single node"""
        node_id = node["id"]
        logger.info(f"Running node {node_id}")
        # Return cached output value from an already-run node if that cached output exists
        if self.output_cache.get(node_id, None) is not None:
            return self.output_cache[node_id]

        inputs = []
        for node_input in node["inputs"]:
            # If input is a dict indication another node, use that node's output value
            if isinstance(node_input, dict) and node_input.get("id", None):
                # Get the next node by id
                next_input = self.nodes[node_input["id"]]
                # Recursively get the value of the input
                processed_input = self.process(next_input)
                # Split the output if necessary and grab the right index from the output
                if type(processed_input) in [list, tuple]:
                    index = next_input["outputs"].index({"id": node_id})
                    processed_input = processed_input[index]
                inputs.append(processed_input)
            # Otherwise, just use the given input (number, string, etc)
            else:
                inputs.append(node_input)
        # Create node based on given category/name information
        node_instance = NodeFactory.create_node(node["category"], node["node"])
        # Run the node and pass in inputs as args
        output = node_instance.run(*inputs)
        # Cache the output of the node
        self.output_cache[node_id] = output
        return output

    def run(self):
        """Run the executor"""
        logger.info(f"Running executor {self.execution_id}")
        # Create a list of all output nodes
        output_nodes = []
        for node in self.nodes.values():
            if node["outputs"] is None or len(node["outputs"]) == 0:
                output_nodes.append(node)
        # Run each of the output nodes through processing
        for output_node in output_nodes:
            self.process(output_node)
