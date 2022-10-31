from abc import ABCMeta, abstractmethod
from typing import Any, Dict, List, Literal, Optional, Union

from base_types import InputId, OutputId

from .category import Category
from .group import Group, GroupInfo, GroupId

from .properties.inputs.base_input import BaseInput
from .properties.outputs.base_output import BaseOutput


NodeType = Literal["regularNode", "iterator", "iteratorHelper"]

# pylint: disable-next=redefined-builtin
def group(kind: str, options: Optional[Dict[str, Any]] = None, id: int = -1):
    info = GroupInfo(GroupId(id), kind, options)

    def ret(*items: BaseInput) -> Group[BaseInput]:
        return Group(info, list(items))

    return ret


class NodeBase(metaclass=ABCMeta):
    """Base class for a node"""

    def __init__(self):
        self.__inputs: List[BaseInput] = []
        self.__outputs: List[BaseOutput] = []
        self.__groups: List[Group[InputId]] = []
        self.description: str = ""

        self.category: Category = Category(
            "Unknown", "Unknown category", "BsQuestionDiamond", "#718096"
        )
        self.name: str = ""
        self.icon: str = ""
        self.sub: str = "Miscellaneous"
        self.type: NodeType = "regularNode"

        self.side_effects: bool = False
        self.deprecated: bool = False

    @property
    def inputs(self) -> List[BaseInput]:
        return self.__inputs

    @inputs.setter
    def inputs(self, value: List[Union[BaseInput, Group[BaseInput]]]):
        inputs: List[BaseInput] = []
        groups: List[Group[InputId]] = []

        for x in value:
            if isinstance(x, Group):
                ids: List[InputId] = []
                for y in x.items:
                    if y.id == -1:
                        y.id = InputId(len(inputs))
                    inputs.append(y)
                    ids.append(y.id)

                if x.info.id == -1:
                    x.info.id = GroupId(len(groups))
                groups.append(Group(x.info, ids))
            else:
                if x.id == -1:
                    x.id = InputId(len(inputs))
                inputs.append(x)

        self.__inputs = inputs
        self.__groups = groups

    @property
    def outputs(self) -> List[BaseOutput]:
        return self.__outputs

    @outputs.setter
    def outputs(self, value: List[BaseOutput]):
        for i, output_value in enumerate(value):
            if output_value.id == -1:
                output_value.id = OutputId(i)
        self.__outputs = value

    @property
    def groups(self) -> List[Group[InputId]]:
        return self.__groups

    @abstractmethod
    def run(self) -> Any:
        """Abstract method to run a node's logic"""
        return


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
