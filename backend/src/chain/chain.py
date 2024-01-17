from __future__ import annotations

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
        if self.data.type != "regularNode":
            raise ValueError(
                f"Invalid node type {self.data.type}. Expected regularNode."
            )

    def has_side_effects(self) -> bool:
        return self.data.side_effects


class NewIteratorNode:
    def __init__(self, node_id: NodeId, schema_id: str):
        self.id: NodeId = node_id
        self.schema_id: str = schema_id
        self.data: NodeData = registry.get_node(schema_id)
        if self.data.type != "newIterator":
            raise ValueError(
                f"Invalid node type {self.data.type}. Expected newIterator."
            )

    def has_side_effects(self) -> bool:
        return self.data.side_effects


class CollectorNode:
    def __init__(self, node_id: NodeId, schema_id: str):
        self.id: NodeId = node_id
        self.schema_id: str = schema_id
        self.data: NodeData = registry.get_node(schema_id)
        if self.data.type != "collector":
            raise ValueError(f"Invalid node type {self.data.type}. Expected collector.")

    def has_side_effects(self) -> bool:
        return self.data.side_effects


Node = Union[FunctionNode, NewIteratorNode, CollectorNode]


class EdgeSource:
    def __init__(self, node_id: NodeId, output_id: OutputId):
        self.id: NodeId = node_id
        self.output_id: OutputId = output_id


class EdgeTarget:
    def __init__(self, node_id: NodeId, input_id: InputId):
        self.id: NodeId = node_id
        self.input_id: InputId = input_id


class Edge:
    def __init__(self, source: EdgeSource, target: EdgeTarget):
        self.source = source
        self.target = target


class Chain:
    def __init__(self):
        self.nodes: dict[NodeId, Node] = {}
        self.__edges_by_source: dict[NodeId, list[Edge]] = {}
        self.__edges_by_target: dict[NodeId, list[Edge]] = {}

    def add_node(self, node: Node):
        if node.id in self.nodes:
            raise ValueError(f"Duplicate node id {node.id}")
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        get_or_add(self.__edges_by_source, edge.source.id, list).append(edge)
        get_or_add(self.__edges_by_target, edge.target.id, list).append(edge)

    def edges_from(self, source: NodeId) -> list[Edge]:
        return self.__edges_by_source.get(source, [])

    def edges_to(self, target: NodeId) -> list[Edge]:
        return self.__edges_by_target.get(target, [])

    def remove_node(self, node_id: NodeId):
        """
        Removes the node with the given id.
        If the node is an iterator node, then all of its children will also be removed.
        """

        node = self.nodes.pop(node_id, None)
        if node is None:
            return

        for e in self.__edges_by_source.pop(node_id, []):
            self.__edges_by_target[e.target.id].remove(e)
        for e in self.__edges_by_target.pop(node_id, []):
            self.__edges_by_source[e.source.id].remove(e)

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

    def get_parent_iterator_map(self) -> dict[FunctionNode, NewIteratorNode | None]:
        """
        Returns a map of all function nodes to their parent iterator node (if any).
        """
        iterator_cache: dict[FunctionNode, NewIteratorNode | None] = {}

        def get_iterator(r: FunctionNode) -> NewIteratorNode | None:
            if r in iterator_cache:
                return iterator_cache[r]

            iterator: NewIteratorNode | None = None

            for in_edge in self.edges_to(r.id):
                source = self.nodes[in_edge.source.id]
                if isinstance(source, FunctionNode):
                    iterator = get_iterator(source)
                    if iterator is not None:
                        break
                elif isinstance(source, NewIteratorNode):
                    if (
                        in_edge.source.output_id
                        in source.data.single_iterator_output.outputs
                    ):
                        iterator = source
                        break

            iterator_cache[r] = iterator
            return iterator

        for node in self.nodes.values():
            if isinstance(node, FunctionNode):
                get_iterator(node)

        return iterator_cache
