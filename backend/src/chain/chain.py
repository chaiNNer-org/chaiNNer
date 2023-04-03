from typing import Callable, Dict, List, TypeVar, Union

from api import Node, registry
from base_types import InputId, NodeId, OutputId

K = TypeVar("K")
V = TypeVar("V")


def get_or_add(d: Dict[K, V], key: K, supplier: Callable[[], V]) -> V:
    value = d.get(key)
    if value is None:
        value = supplier()
        d[key] = value
    return value


class FunctionNode:
    def __init__(self, node_id: NodeId, schema_id: str):
        self.id: NodeId = node_id
        self.schema_id: str = schema_id
        self.parent: Union[NodeId, None] = None
        self.is_helper: bool = False

    def get_node(self) -> Node:
        return registry.get_node(self.schema_id)

    def has_side_effects(self) -> bool:
        return self.get_node().side_effects


class IteratorNode:
    def __init__(self, node_id: NodeId, schema_id: str):
        self.id: NodeId = node_id
        self.schema_id: str = schema_id
        self.parent: None = None
        self.__node = None

    def get_node(self) -> Node:
        if self.__node is None:
            node = registry.get_node(self.schema_id)
            assert node.type == "iterator", "Invalid iterator node"
            self.__node = node
        return self.__node


FunctionalNodes = Union[FunctionNode, IteratorNode]


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
        self.nodes: Dict[NodeId, FunctionalNodes] = {}
        self.__edges_by_source: Dict[NodeId, List[Edge]] = {}
        self.__edges_by_target: Dict[NodeId, List[Edge]] = {}

    def add_node(self, node: FunctionalNodes):
        assert node.id not in self.nodes, f"Duplicate node id {node.id}"
        self.nodes[node.id] = node

    def add_edge(self, edge: Edge):
        get_or_add(self.__edges_by_source, edge.source.id, list).append(edge)
        get_or_add(self.__edges_by_target, edge.target.id, list).append(edge)

    def edges_from(self, source: NodeId) -> List[Edge]:
        return self.__edges_by_source.get(source, [])

    def edges_to(self, target: NodeId) -> List[Edge]:
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

        if isinstance(node, IteratorNode):
            # remove all child nodes
            for n in list(self.nodes.values()):
                if n.parent == node_id:
                    self.remove_node(n.id)


class SubChain:
    def __init__(self, chain: Chain, iterator_id: NodeId):
        self.nodes: Dict[NodeId, FunctionNode] = {}
        self.iterator_id = iterator_id

        for node in chain.nodes.values():
            if node.parent is not None and node.parent == iterator_id:
                self.nodes[node.id] = node
