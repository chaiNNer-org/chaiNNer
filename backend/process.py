from typing import List, Dict
import uuid

from nodes.NodeFactory import NodeFactory


class Executor():
    def __init__(self, nodes: List[Dict]):
        """ Constructor """
        self.execution_id = uuid.uuid4().hex
        self.nodes = nodes
        self.output_cache = {}

    def process(self, node: Dict):
        # Return cached output value from an already-run node if that cached output exists
        if self.output_cache.get(node['id'], None) is not None:
            return self.output_cache[node['id']]

        inputs = []
        for input in node['inputs']:
            # If input is a dict indication another node, use that node's output value
            if type(input) is dict and input.get('id', None):
                # Get the next node by id
                next_input = self.nodes[input['id']]
                # Recursively get the value of the input
                processed_input = self.process(next_input)
                # Split the output if necessary and grab the right index from the output
                if type(processed_input) in [list, tuple]:
                    index = next_input['outputs'].index({'id': node['id']})
                    processed_input = processed_input[index]
                inputs.append(processed_input)
            # Otherwise, just use the given input (number, string, etc)
            else:
                inputs.append(input)
        # Create node based on given category/name information
        node_instance = NodeFactory.create_node(node['category'], node['node'])
        # Run the node and pass in inputs as args
        output = node_instance.run(*inputs)
        # Cache the output of the node
        self.output_cache[node['id']] = output
        return output

    def run(self):
        # Create a list of all output nodes
        output_nodes = []
        for node in self.nodes.values():
            if node['outputs'] is None:
                output_nodes.append(node)
        # Run each of the output nodes through processing
        for output_node in output_nodes:
            self.process(output_node)
