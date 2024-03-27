from __future__ import annotations

from typing import Literal, TypedDict, Union

from api import NodeId

from .chain import (
    Chain,
    CollectorNode,
    Edge,
    EdgeSource,
    EdgeTarget,
    FunctionNode,
    NewIteratorNode,
)


class JsonEdgeInput(TypedDict):
    type: Literal["edge"]
    id: NodeId
    index: int


class JsonValueInput(TypedDict):
    type: Literal["value"]
    value: object


JsonInput = Union[JsonEdgeInput, JsonValueInput]


class JsonNode(TypedDict):
    id: NodeId
    schemaId: str
    inputs: list[JsonInput]
    parent: NodeId | None
    nodeType: str


class IndexEdge:
    def __init__(
        self, from_id: NodeId, from_index: int, to_id: NodeId, to_index: int
    ) -> None:
        self.from_id = from_id
        self.from_index = from_index
        self.to_id = to_id
        self.to_index = to_index


def parse_json(json: list[JsonNode]) -> Chain:
    chain = Chain()

    index_edges: list[IndexEdge] = []

    for json_node in json:
        if json_node["nodeType"] == "newIterator":
            node = NewIteratorNode(json_node["id"], json_node["schemaId"])
        elif json_node["nodeType"] == "collector":
            node = CollectorNode(json_node["id"], json_node["schemaId"])
        else:
            node = FunctionNode(json_node["id"], json_node["schemaId"])
        chain.add_node(node)

        inputs = node.data.inputs
        for index, i in enumerate(json_node["inputs"]):
            if i["type"] == "edge":
                index_edges.append(IndexEdge(i["id"], i["index"], node.id, index))
            else:
                chain.inputs.set(node.id, inputs[index].id, i["value"])

    for index_edge in index_edges:
        source_node = chain.nodes[index_edge.from_id].data
        target_node = chain.nodes[index_edge.to_id].data

        chain.add_edge(
            Edge(
                EdgeSource(
                    index_edge.from_id,
                    source_node.outputs[index_edge.from_index].id,
                ),
                EdgeTarget(
                    index_edge.to_id,
                    target_node.inputs[index_edge.to_index].id,
                ),
            )
        )

    return chain
