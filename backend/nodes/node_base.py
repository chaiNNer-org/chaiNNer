from abc import ABCMeta, abstractmethod
from typing import Any


class NodeBase(metaclass=ABCMeta):
    """Base class for a node"""

    def __init__(self):
        """Constructor"""
        self.inputs = []
        self.outputs = []
        self.description = ""
        self.icon = ""
        self.sub = "Miscellaneous"
        self.type = "regularNode"

    @abstractmethod
    def run(self, **kwargs) -> Any:
        """Abstract method to run a node's logic"""
        return

    def get_inputs(self):
        return self.inputs

    def get_outputs(self):
        return self.outputs

    def get_description(self):
        return self.description

    def get_icon(self):
        return self.icon

    def get_sub_category(self):
        return self.sub

    def get_type(self):
        return self.type


class IteratorNodeBase(NodeBase):
    """Base class for an iterator node"""

    def __init__(self):
        """Constructor"""
        self.inputs = []
        self.outputs = []
        self.description = ""
        self.icon = "MdLoop"
        self.sub = "Iteration"
        self.type = "iterator"
        self.default_nodes = []

    def get_default_nodes(self):
        return self.default_nodes
