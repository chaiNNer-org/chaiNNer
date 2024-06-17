from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, TypeVar, Union

from api import InputId, NodeData, NodeId, OutputId, registry

K = TypeVar("K")
V = TypeVar("V")


def get_or_add(d: dict[K, V], key: K, supplier: Callable[[], V]) -> V:
    value = d.get(key)
    if value is None:
        value = supplier()
        d[key] = value
    return value


class FunctionNode:
    def __init__(self, node_id: NodeId, schema_id: str):
        self.id: NodeId = node_id
        self.schema_id: str = schema_id
        self.data: NodeData = registry.get_node(schema_id)
        assert self.data.kind == "regularNode"

    def has_side_effects(self) -> bool:
        return self.data.side_effects


class GeneratorNode:
    def __init__(self, node_id: NodeId, schema_id: str):
        self.id: NodeId = node_id
        self.schema_id: str = schema_id
        self.data: NodeData = registry.get_node(schema_id)
        assert self.data.kind == "generator"

    def has_side_effects(self) -> bool:
        return self.data.side_effects


class CollectorNode:
    def __init__(self, node_id: NodeId, schema_id: str):
        self.id: NodeId = node_id
        self.schema_id: str = schema_id
        self.data: NodeData = registry.get_node(schema_id)
        assert self.data.kind == "collector"

    def has_side_effects(self) -> bool:
        return self.data.side_effects


Node = Union[FunctionNode, GeneratorNode, CollectorNode]


@dataclass(frozen=True)
class EdgeSource:
    id: NodeId
    output_id: OutputId


@dataclass(frozen=True)
class EdgeTarget:
    id: NodeId
    input_id: InputId


@dataclass(frozen=True)
class Edge:
    source: EdgeSource
    target: EdgeTarget


class ChainInputs:
    def __init__(self) -> None:
        self.inputs: dict[NodeId, dict[InputId, object]] = {}

    def get(self, node_id: NodeId, input_id: InputId) -> object | None:
        node = self.inputs.get(node_id)
        if node is None:
            return None
        return node.get(input_id)

    def set(self, node_id: NodeId, input_id: InputId, value: object) -> None:
        get_or_add(self.inputs, node_id, dict)[input_id] = value


class Chain:
    def __init__(self):
        self.nodes: dict[NodeId, Node] = {}
        self.inputs: ChainInputs = ChainInputs()
        self.__edges_by_source: dict[NodeId, list[Edge]] = {}
        self.__edges_by_target: dict[NodeId, list[Edge]] = {}

    def nodes_with_schema_id(self, schema_id: str) -> list[Node]:
        return [node for node in self.nodes.values() if node.schema_id == schema_id]

    def add_node(self, node: Node):
        assert node.id not in self.nodes, f"Duplicate node id {node.id}"
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        get_or_add(self.__edges_by_source, edge.source.id, list).append(edge)
        get_or_add(self.__edges_by_target, edge.target.id, list).append(edge)

    def edges_from(
        self,
        source: NodeId,
        output_id: OutputId | None = None,
    ) -> list[Edge]:
        edges = self.__edges_by_source.get(source, [])
        if output_id is not None:
            return [e for e in edges if e.source.output_id == output_id]
        return edges

    def edges_to(self, target: NodeId) -> list[Edge]:
        return self.__edges_by_target.get(target, [])

    def edge_to(self, target: NodeId, input_id: InputId) -> Edge | None:
        """
        Returns the edge connected to the given input (if any).
        """
        edges = self.__edges_by_target.get(target)
        if edges is not None:
            for e in edges:
                if e.target.input_id == input_id:
                    return e
        return None

    def remove_node(self, node_id: NodeId):
        """
        Removes the node with the given id.
        If the node is an iterator node, then all of its children will also be removed.
        """

        self.inputs.inputs.pop(node_id, None)
        node = self.nodes.pop(node_id, None)
        if node is None:
            return

        for e in self.__edges_by_source.pop(node_id, []):
            self.__edges_by_target[e.target.id].remove(e)
        for e in self.__edges_by_target.pop(node_id, []):
            self.__edges_by_source[e.source.id].remove(e)

    def remove_edge(self, edge: Edge) -> None:
        """
        Removes the edge connected to the given input (if any).
        """
        edges_target = self.__edges_by_target.get(edge.target.id)
        if edges_target is not None:
            edges_target.remove(edge)
        edges_source = self.__edges_by_source.get(edge.source.id)
        if edges_source is not None:
            edges_source.remove(edge)

    def topological_order(self) -> list[NodeId]:
        """
        Returns all nodes in topological order.
        """
        result: list[NodeId] = []
        visited: set[NodeId] = set()

        def visit(node_id: NodeId):
            if node_id in visited:
                return
            visited.add(node_id)

            for e in self.edges_from(node_id):
                visit(e.target.id)

            result.append(node_id)

        for node_id in self.nodes:
            visit(node_id)

        return result

    def get_parent_iterator_map(self) -> dict[FunctionNode, GeneratorNode | None]:
        """
        Returns a map of all function nodes to their parent iterator node (if any).
        """
        iterator_cache: dict[FunctionNode, GeneratorNode | None] = {}

        def get_iterator(r: FunctionNode) -> GeneratorNode | None:
            if r in iterator_cache:
                return iterator_cache[r]

            iterator: GeneratorNode | None = None

            for in_edge in self.edges_to(r.id):
                source = self.nodes[in_edge.source.id]
                if isinstance(source, FunctionNode):
                    iterator = get_iterator(source)
                    if iterator is not None:
                        break
                elif isinstance(source, GeneratorNode):
                    if (
                        in_edge.source.output_id
                        in source.data.single_iterable_output.outputs
                    ):
                        iterator = source
                        break

            iterator_cache[r] = iterator
            return iterator

        for node in self.nodes.values():
            if isinstance(node, FunctionNode):
                get_iterator(node)

        return iterator_cache
