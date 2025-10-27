"""Tests for chain cache functionality."""

from __future__ import annotations

from unittest.mock import Mock

from api import NodeId, OutputId
from chain.cache import (
    CacheStrategy,
    OutputCache,
    StaticCaching,
    get_cache_strategies,
)
from chain.chain import Chain, Edge, EdgeSource, EdgeTarget


def create_mock_function_node(
    node_id: NodeId, schema_id: str = "test:function"
) -> Mock:
    """Create a mock function node for testing."""
    node = Mock()
    node.id = node_id
    node.schema_id = schema_id
    mock_data = Mock()
    mock_data.kind = "regularNode"
    mock_data.side_effects = False
    mock_data.inputs = []
    mock_data.outputs = []
    node.data = mock_data
    return node


def create_mock_generator_node(
    node_id: NodeId, schema_id: str = "test:generator"
) -> Mock:
    """Create a mock generator node for testing."""
    node = Mock()
    node.id = node_id
    node.schema_id = schema_id
    mock_data = Mock()
    mock_data.kind = "generator"
    mock_data.side_effects = False
    mock_data.inputs = []
    mock_data.outputs = []
    # Mock single_iterable_output
    mock_iterable = Mock()
    mock_iterable.outputs = [OutputId(0)]
    mock_data.single_iterable_output = mock_iterable
    node.data = mock_data
    return node


def test_cache_strategy_creation():
    """Test creating cache strategies."""
    strategy = CacheStrategy(5)
    assert strategy.hits_to_live == 5
    assert not strategy.static
    assert not strategy.no_caching


def test_cache_strategy_static():
    """Test static cache strategy."""
    assert StaticCaching.static
    assert not StaticCaching.no_caching
    assert StaticCaching.hits_to_live == CacheStrategy.STATIC_HITS_TO_LIVE


def test_cache_strategy_no_caching():
    """Test no caching strategy."""
    strategy = CacheStrategy(0)
    assert strategy.no_caching
    assert not strategy.static


def test_output_cache_creation():
    """Test creating an output cache."""
    cache: OutputCache[int] = OutputCache()
    assert cache.parent is None
    assert len(cache.keys()) == 0


def test_output_cache_creation_with_parent():
    """Test creating an output cache with parent."""
    parent_cache: OutputCache[int] = OutputCache()
    child_cache: OutputCache[int] = OutputCache(parent=parent_cache)
    assert child_cache.parent == parent_cache


def test_output_cache_creation_with_static_data():
    """Test creating an output cache with static data."""
    static_data = {NodeId("node1"): 42, NodeId("node2"): 99}
    cache: OutputCache[int] = OutputCache(static_data=static_data)
    
    assert cache.has(NodeId("node1"))
    assert cache.get(NodeId("node1")) == 42
    assert cache.has(NodeId("node2"))
    assert cache.get(NodeId("node2")) == 99


def test_output_cache_set_and_get_static():
    """Test setting and getting static cached values."""
    cache: OutputCache[str] = OutputCache()
    node_id = NodeId("node1")
    
    cache.set(node_id, "value1", StaticCaching)
    
    assert cache.has(node_id)
    assert cache.get(node_id) == "value1"


def test_output_cache_set_and_get_counted():
    """Test setting and getting counted cached values."""
    cache: OutputCache[str] = OutputCache()
    node_id = NodeId("node1")
    
    cache.set(node_id, "value1", CacheStrategy(3))
    
    assert cache.has(node_id)
    assert cache.get(node_id) == "value1"


def test_output_cache_counted_hits_decrease():
    """Test that counted cache hits decrease with each get."""
    cache: OutputCache[str] = OutputCache()
    node_id = NodeId("node1")
    
    # Set with 3 hits to live
    cache.set(node_id, "value1", CacheStrategy(3))
    
    # First get
    assert cache.get(node_id) == "value1"
    assert cache.has(node_id)
    
    # Second get
    assert cache.get(node_id) == "value1"
    assert cache.has(node_id)
    
    # Third get
    assert cache.get(node_id) == "value1"
    assert cache.has(node_id)


def test_output_cache_no_caching_strategy():
    """Test that no caching strategy doesn't store values."""
    cache: OutputCache[str] = OutputCache()
    node_id = NodeId("node1")
    
    cache.set(node_id, "value1", CacheStrategy(0))
    
    assert not cache.has(node_id)
    assert cache.get(node_id) is None


def test_output_cache_get_nonexistent():
    """Test getting a nonexistent value returns None."""
    cache: OutputCache[str] = OutputCache()
    assert cache.get(NodeId("nonexistent")) is None


def test_output_cache_has_nonexistent():
    """Test checking existence of nonexistent value."""
    cache: OutputCache[str] = OutputCache()
    assert not cache.has(NodeId("nonexistent"))


def test_output_cache_parent_lookup():
    """Test that cache looks up values in parent."""
    parent_cache: OutputCache[str] = OutputCache()
    child_cache: OutputCache[str] = OutputCache(parent=parent_cache)
    
    node_id = NodeId("node1")
    parent_cache.set(node_id, "parent_value", StaticCaching)
    
    # Child should find value in parent
    assert child_cache.has(node_id)
    assert child_cache.get(node_id) == "parent_value"


def test_output_cache_child_overrides_parent():
    """Test that child cache value overrides parent."""
    parent_cache: OutputCache[str] = OutputCache()
    child_cache: OutputCache[str] = OutputCache(parent=parent_cache)
    
    node_id = NodeId("node1")
    parent_cache.set(node_id, "parent_value", StaticCaching)
    child_cache.set(node_id, "child_value", StaticCaching)
    
    # Child value should override parent
    assert child_cache.get(node_id) == "child_value"


def test_output_cache_delete():
    """Test deleting a cached value."""
    cache: OutputCache[str] = OutputCache()
    node_id = NodeId("node1")
    
    cache.set(node_id, "value1", StaticCaching)
    assert cache.has(node_id)
    
    cache.delete(node_id)
    assert not cache.has(node_id)


def test_output_cache_delete_many():
    """Test deleting multiple cached values."""
    cache: OutputCache[str] = OutputCache()
    node1 = NodeId("node1")
    node2 = NodeId("node2")
    node3 = NodeId("node3")
    
    cache.set(node1, "value1", StaticCaching)
    cache.set(node2, "value2", StaticCaching)
    cache.set(node3, "value3", StaticCaching)
    
    cache.delete_many([node1, node2])
    
    assert not cache.has(node1)
    assert not cache.has(node2)
    assert cache.has(node3)


def test_output_cache_clear():
    """Test clearing all cached values."""
    cache: OutputCache[str] = OutputCache()
    
    cache.set(NodeId("node1"), "value1", StaticCaching)
    cache.set(NodeId("node2"), "value2", CacheStrategy(5))
    
    cache.clear()
    
    assert not cache.has(NodeId("node1"))
    assert not cache.has(NodeId("node2"))


def test_output_cache_keys():
    """Test getting all cache keys."""
    cache: OutputCache[str] = OutputCache()
    node1 = NodeId("node1")
    node2 = NodeId("node2")
    
    cache.set(node1, "value1", StaticCaching)
    cache.set(node2, "value2", CacheStrategy(5))
    
    keys = cache.keys()
    assert node1 in keys
    assert node2 in keys


def test_output_cache_keys_includes_parent():
    """Test that keys includes parent keys."""
    parent_cache: OutputCache[str] = OutputCache()
    child_cache: OutputCache[str] = OutputCache(parent=parent_cache)
    
    parent_node = NodeId("parent_node")
    child_node = NodeId("child_node")
    
    parent_cache.set(parent_node, "parent_value", StaticCaching)
    child_cache.set(child_node, "child_value", StaticCaching)
    
    keys = child_cache.keys()
    assert parent_node in keys
    assert child_node in keys


def test_get_cache_strategies_simple_chain():
    """Test getting cache strategies for a simple chain."""
    chain = Chain()
    node1 = create_mock_function_node(NodeId("node1"))
    node2 = create_mock_function_node(NodeId("node2"))
    
    chain.add_node(node1)
    chain.add_node(node2)
    
    # Add edge from node1 to node2
    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), 0),
    )
    chain.add_edge(edge)
    
    strategies = get_cache_strategies(chain)
    
    # Both nodes should have strategies
    assert NodeId("node1") in strategies
    assert NodeId("node2") in strategies


def test_get_cache_strategies_node_with_multiple_outputs():
    """Test cache strategies for node with multiple output edges."""
    chain = Chain()
    node1 = create_mock_function_node(NodeId("node1"))
    node2 = create_mock_function_node(NodeId("node2"))
    node3 = create_mock_function_node(NodeId("node3"))
    
    chain.add_node(node1)
    chain.add_node(node2)
    chain.add_node(node3)
    
    # node1 outputs to both node2 and node3
    edge1 = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), 0),
    )
    edge2 = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node3"), 0),
    )
    chain.add_edge(edge1)
    chain.add_edge(edge2)
    
    strategies = get_cache_strategies(chain)
    
    # node1 should have hits_to_live = 2 (two output edges)
    assert strategies[NodeId("node1")].hits_to_live == 2


def test_get_cache_strategies_no_outputs():
    """Test cache strategies for node with no outputs."""
    chain = Chain()
    node1 = create_mock_function_node(NodeId("node1"))
    
    chain.add_node(node1)
    
    strategies = get_cache_strategies(chain)
    
    # Node with no outputs should have hits_to_live = 0
    assert strategies[NodeId("node1")].hits_to_live == 0
