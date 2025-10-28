from __future__ import annotations

from dataclasses import dataclass

from api import NodeData, NodeId, OutputId

from .chain import Chain


@dataclass(frozen=True)
class EdgeInput:
    id: NodeId
    index: int


@dataclass(frozen=True)
class ValueInput:
    value: object


Input = EdgeInput | ValueInput


class InputMap:
    def __init__(self) -> None:
        self.data: dict[NodeId, list[Input]] = {}

    @staticmethod
    def from_chain(chain: Chain) -> InputMap:
        input_map = InputMap()

        def get_output_index(data: NodeData, output_id: OutputId) -> int:
            for i, output in enumerate(data.outputs):
                if output.id == output_id:
                    return i
            raise AssertionError(f"Unknown output id {output_id}")

        for node in chain.nodes.values():
            inputs: list[Input] = []

            for i in node.data.inputs:
                edge = chain.edge_to(node.id, i.id)
                if edge is not None:
                    source = chain.nodes[edge.source.id]
                    output_index = get_output_index(source.data, edge.source.output_id)
                    inputs.append(EdgeInput(edge.source.id, output_index))
                else:
                    inputs.append(ValueInput(chain.inputs.get(node.id, i.id)))

            input_map.data[node.id] = inputs

        return input_map

    def get(self, node_id: NodeId) -> list[Input]:
        values = self.data.get(node_id, None)
        if values is not None:
            return values

        raise AssertionError(f"Unknown node id {node_id}")
