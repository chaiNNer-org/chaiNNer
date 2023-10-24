from typing import Dict, List, Optional, Union

from api2 import NodeId


class EdgeInput:
    def __init__(self, node_id: NodeId, index: int) -> None:
        self.id = node_id
        self.index = index


class ValueInput:
    def __init__(self, value: object) -> None:
        self.value: object = value


Input = Union[EdgeInput, ValueInput]


class InputMap:
    def __init__(self, parent: Optional["InputMap"] = None) -> None:
        self.__data: Dict[NodeId, List[Input]] = {}
        self.parent: Optional[InputMap] = parent

    def get(self, node_id: NodeId) -> List[Input]:
        values = self.__data.get(node_id, None)
        if values is not None:
            return values

        if self.parent:
            return self.parent.get(node_id)

        assert False, f"Unknown node id {node_id}"

    def set(self, node_id: NodeId, values: List[Input]):
        self.__data[node_id] = values

    def set_values(self, node_id: NodeId, values: List[object]):
        self.__data[node_id] = [ValueInput(x) for x in values]

    def set_append(self, node_id: NodeId, values: List[Input]):
        inputs = [*self.get(node_id), *values]
        self.set(node_id, inputs)

    def set_append_values(self, node_id: NodeId, values: List[object]):
        inputs = [*self.get(node_id), *[ValueInput(x) for x in values]]
        self.set(node_id, inputs)
