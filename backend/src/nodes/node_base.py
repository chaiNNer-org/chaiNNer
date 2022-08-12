from abc import ABCMeta, abstractmethod
from typing import Any, List, Union

from .categories import Category

from .properties.inputs.base_input import BaseInput
from .properties.outputs.base_output import BaseOutput


def assign_implicit_ids(l: Union[List[BaseInput], List[BaseOutput]]):
    for i, inout in enumerate(l):
        if inout.id is None:
            inout.id = i


class NodeBase(metaclass=ABCMeta):
    """Base class for a node"""

    def __init__(self):
        self.inputs: List[BaseInput] = []
        self.outputs: List[BaseOutput] = []
        self.description: str = ""

        self.category: Category = Category(
            "Unknown", "Unknown category", "BsQuestionDiamond", "#718096"
        )
        self.name: str = ""
        self.icon: str = ""
        self.sub: str = "Miscellaneous"
        self.type: str = "regularNode"

        self.side_effects: bool = False
        self.deprecated: bool = False

    @abstractmethod
    def run(self) -> Any:
        """Abstract method to run a node's logic"""
        return

    def get_inputs(self, with_implicit_ids=False):
        if with_implicit_ids:
            assign_implicit_ids(self.inputs)
        return self.inputs

    def get_outputs(self, with_implicit_ids=False):
        if with_implicit_ids:
            assign_implicit_ids(self.outputs)
        return self.outputs


# pylint: disable=abstract-method
class IteratorNodeBase(NodeBase):
    """Base class for an iterator node"""

    def __init__(self):
        super().__init__()
        self.icon = "MdLoop"
        self.sub = "Iteration"
        self.type = "iterator"
        self.default_nodes = []

        self.side_effects = True

    def get_default_nodes(self):
        return self.default_nodes
