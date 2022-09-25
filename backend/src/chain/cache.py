from typing import Any, Dict, Iterable, Optional, Set
import gc
from sanic.log import logger

from .chain import NodeId, Chain


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


def get_cache_strategies(chain: Chain) -> Dict[NodeId, CacheStrategy]:
    """Create a map with the cache strategies for all nodes in the given chain."""

    result: Dict[NodeId, CacheStrategy] = {}

    for node in chain.nodes.values():
        out_edges = chain.edges_from(node.id)
        connected_to_child_node = any(
            chain.nodes[e.target.id].parent for e in out_edges
        )

        strategy: CacheStrategy
        if node.parent is None and connected_to_child_node:
            # free nodes that are connected to child nodes need to live as the execution
            strategy = StaticCaching
        else:
            strategy = CacheStrategy(len(out_edges))

        result[node.id] = strategy

    return result


class _CacheEntry:
    def __init__(self, value: Any, hits_to_live: int):
        assert hits_to_live > 0
        self.value = value
        self.hits_to_live = hits_to_live


class OutputCache:
    def __init__(
        self,
        parent: Optional["OutputCache"] = None,
        static_data: Optional[Dict[NodeId, Any]] = None,
    ):
        super().__init__()
        self.__static: Dict[NodeId, Any] = static_data.copy() if static_data else {}
        self.__counted: Dict[NodeId, _CacheEntry] = {}
        self.parent: Optional[OutputCache] = parent

    def keys(self) -> Iterable[NodeId]:
        keys: Set[NodeId] = set()
        keys.union(self.__static.keys(), self.__counted.keys())
        if self.parent:
            keys.union(self.parent.keys())
        return keys

    def has(self, node_id: NodeId) -> bool:
        if node_id in self.__static or node_id in self.__counted:
            return True
        if self.parent:
            return self.parent.has(node_id)
        return False

    def get(self, node_id: NodeId) -> Optional[Any]:
        staticValue = self.__static.get(node_id, None)
        if staticValue is not None:
            return staticValue

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

    def set(self, node_id: NodeId, value: Any, strategy: CacheStrategy):
        if strategy.no_caching:
            return
        elif strategy.static:
            self.__static[node_id] = value
        else:
            self.__counted[node_id] = _CacheEntry(value, strategy.hits_to_live)
