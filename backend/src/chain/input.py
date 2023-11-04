from __future__ import annotations

from typing import TYPE_CHECKING, Union

if TYPE_CHECKING:
    from api import NodeId


class EdgeInput:
    def __init__(self, node_id: NodeId, index: int) -> None:
        self.id = node_id
        self.index = index


class ValueInput:
    def __init__(self, value: object) -> None:
        self.value: object = value


Input = Union[EdgeInput, ValueInput]


class InputMap:
    def __init__(self, parent: InputMap | None = None) -> None:
        self.__data: dict[NodeId, list[Input]] = {}
        self.parent: InputMap | None = parent

    def get(self, node_id: NodeId) -> list[Input]:
        values = self.__data.get(node_id, None)
        if values is not None:
            return values

        if self.parent:
            return self.parent.get(node_id)

        raise AssertionError(f"Unknown node id {node_id}")

    def set(self, node_id: NodeId, values: list[Input]):
        self.__data[node_id] = values

    def set_values(self, node_id: NodeId, values: list[object]):
        self.__data[node_id] = [ValueInput(x) for x in values]

    def set_append(self, node_id: NodeId, values: list[Input]):
        inputs = [*self.get(node_id), *values]
        self.set(node_id, inputs)

    def set_append_values(self, node_id: NodeId, values: list[object]):
        inputs = [*self.get(node_id), *[ValueInput(x) for x in values]]
        self.set(node_id, inputs)
