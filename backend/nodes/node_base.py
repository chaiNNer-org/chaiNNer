from abc import ABCMeta, abstractmethod
from typing import Any


class NodeBase(metaclass=ABCMeta):
    """Base class for a node"""

    def __init__(self):
        """Constructor"""
        self.inputs = []
        self.outputs = []
        self.description = ""

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
