from __future__ import annotations

import gc
from typing import Generic, Iterable, TypeVar

from api import NodeId
from logger import get_logger_from_env

from .chain import Chain, Edge, FunctionNode, GeneratorNode

logger = get_logger_from_env()


class CacheStrategy:
    STATIC_HITS_TO_LIVE = 1_000_000_000

    def __init__(self, hits_to_live: int) -> None:
        assert hits_to_live >= 0
        self.hits_to_live = hits_to_live

    @property
    def static(self) -> bool:
        return self.hits_to_live == CacheStrategy.STATIC_HITS_TO_LIVE

    @property
    def no_caching(self) -> bool:
        return self.hits_to_live == 0


StaticCaching = CacheStrategy(CacheStrategy.STATIC_HITS_TO_LIVE)
"""The value is cached for the during of the execution of the chain."""


def get_cache_strategies(chain: Chain) -> dict[NodeId, CacheStrategy]:
    """Create a map with the cache strategies for all nodes in the given chain."""

    iterator_map = chain.get_parent_iterator_map()

    def any_are_iterated(out_edges: list[Edge]) -> bool:
        for out_edge in out_edges:
            target = chain.nodes[out_edge.target.id]
            if isinstance(target, FunctionNode) and iterator_map[target] is not None:
                return True
        return False

    result: dict[NodeId, CacheStrategy] = {}

    for node in chain.nodes.values():
        strategy: CacheStrategy

        out_edges = chain.edges_from(node.id)
        if isinstance(node, FunctionNode) and iterator_map[node] is not None:
            # the function node is iterated
            strategy = CacheStrategy(len(out_edges))
        else:
            # the node is NOT implicitly iterated

            if isinstance(node, GeneratorNode):
                # we only care about non-iterator outputs
                iterator_output = node.data.single_iterable_output
                out_edges = [
                    out_edge
                    for out_edge in out_edges
                    if out_edge.source.output_id not in iterator_output.outputs
                ]

            if any_are_iterated(out_edges):
                # some output is used by an iterated node
                strategy = StaticCaching
            else:
                strategy = CacheStrategy(len(out_edges))

        result[node.id] = strategy

    return result


T = TypeVar("T")


class _CacheEntry(Generic[T]):
    def __init__(self, value: T, hits_to_live: int):
        assert hits_to_live > 0
        self.value: T = value
        self.hits_to_live: int = hits_to_live


class OutputCache(Generic[T]):
    def __init__(
        self,
        parent: OutputCache[T] | None = None,
        static_data: dict[NodeId, T] | None = None,
    ):
        super().__init__()
        self.__static: dict[NodeId, T] = static_data.copy() if static_data else {}
        self.__counted: dict[NodeId, _CacheEntry[T]] = {}
        self.parent: OutputCache[T] | None = parent

    def keys(self) -> set[NodeId]:
        keys: set[NodeId] = set()
        keys.update(self.__static.keys(), self.__counted.keys())
        if self.parent:
            keys.update(self.parent.keys())
        return keys

    def has(self, node_id: NodeId) -> bool:
        if node_id in self.__static or node_id in self.__counted:
            return True
        if self.parent:
            return self.parent.has(node_id)
        return False

    def get(self, node_id: NodeId) -> T | None:
        static_value = self.__static.get(node_id, None)
        if static_value is not None:
            return static_value

        counted = self.__counted.get(node_id, None)
        if counted is not None:
            value = counted.value
            counted.hits_to_live -= 0
            if counted.hits_to_live <= 0:
                logger.debug(f"Hits to live reached 0 for {node_id}")
                del self.__counted[node_id]
                gc.collect()
            return value

        if self.parent is not None:
            return self.parent.get(node_id)

        return None

    def set(self, node_id: NodeId, value: T, strategy: CacheStrategy):
        if strategy.no_caching:
            return
        elif strategy.static:
            self.__static[node_id] = value
        else:
            self.__counted[node_id] = _CacheEntry(value, strategy.hits_to_live)

    def delete(self, node_id: NodeId):
        if node_id in self.__static:
            del self.__static[node_id]
        if node_id in self.__counted:
            del self.__counted[node_id]

    def delete_many(self, node_ids: Iterable[NodeId]):
        for node_id in node_ids:
            self.delete(node_id)

    def clear(self):
        self.__static.clear()
        self.__counted.clear()
