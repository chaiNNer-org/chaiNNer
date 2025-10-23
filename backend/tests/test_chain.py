"""Tests for the Chain class and related functionality."""

from __future__ import annotations

from unittest.mock import Mock

from api import InputId, NodeId, OutputId
from chain.chain import (
    Chain,
    Edge,
    EdgeSource,
    EdgeTarget,
)


def create_mock_node(node_id: NodeId, schema_id: str, kind: str = "regularNode"):
    """Create a mock node for testing."""
    node = Mock()
    node.id = node_id
    node.schema_id = schema_id
    mock_data = Mock()
    mock_data.kind = kind
    mock_data.side_effects = False
    mock_data.inputs = []
    mock_data.outputs = []
    node.data = mock_data
    return node


def test_chain_creation():
    """Test creating an empty chain."""
    chain = Chain()
    assert chain is not None
    assert len(chain.nodes) == 0


def test_chain_add_node():
    """Test adding nodes to a chain."""
    chain = Chain()
    node = create_mock_node(NodeId("node1"), "test:node")

    chain.add_node(node)

    assert NodeId("node1") in chain.nodes
    assert chain.nodes[NodeId("node1")] == node


def test_chain_add_multiple_nodes():
    """Test adding multiple nodes to a chain."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")
    node2 = create_mock_node(NodeId("node2"), "test:node")

    chain.add_node(node1)
    chain.add_node(node2)

    assert len(chain.nodes) == 2
    assert NodeId("node1") in chain.nodes
    assert NodeId("node2") in chain.nodes


def test_chain_add_edge():
    """Test adding edges between nodes."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")
    node2 = create_mock_node(NodeId("node2"), "test:node")

    chain.add_node(node1)
    chain.add_node(node2)

    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    chain.add_edge(edge)

    edges_from_node1 = chain.edges_from(NodeId("node1"))
    assert len(edges_from_node1) == 1
    assert edges_from_node1[0] == edge

    edges_to_node2 = chain.edges_to(NodeId("node2"))
    assert len(edges_to_node2) == 1
    assert edges_to_node2[0] == edge


def test_chain_edges_from_with_output_id():
    """Test filtering edges by output ID."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")
    node2 = create_mock_node(NodeId("node2"), "test:node")
    node3 = create_mock_node(NodeId("node3"), "test:node")

    chain.add_node(node1)
    chain.add_node(node2)
    chain.add_node(node3)

    edge1 = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    edge2 = Edge(
        EdgeSource(NodeId("node1"), OutputId(1)),
        EdgeTarget(NodeId("node3"), InputId(0)),
    )

    chain.add_edge(edge1)
    chain.add_edge(edge2)

    edges_output_0 = chain.edges_from(NodeId("node1"), OutputId(0))
    assert len(edges_output_0) == 1
    assert edges_output_0[0] == edge1

    edges_output_1 = chain.edges_from(NodeId("node1"), OutputId(1))
    assert len(edges_output_1) == 1
    assert edges_output_1[0] == edge2

    all_edges = chain.edges_from(NodeId("node1"))
    assert len(all_edges) == 2


def test_chain_edge_to():
    """Test getting edge to a specific input."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")
    node2 = create_mock_node(NodeId("node2"), "test:node")

    chain.add_node(node1)
    chain.add_node(node2)

    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    chain.add_edge(edge)

    found_edge = chain.edge_to(NodeId("node2"), InputId(0))
    assert found_edge == edge

    # Test with non-existent input
    not_found = chain.edge_to(NodeId("node2"), InputId(1))
    assert not_found is None


def test_chain_remove_node():
    """Test removing a node from a chain."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")
    node2 = create_mock_node(NodeId("node2"), "test:node")

    chain.add_node(node1)
    chain.add_node(node2)

    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    chain.add_edge(edge)

    # Remove node1
    chain.remove_node(NodeId("node1"))

    assert NodeId("node1") not in chain.nodes
    assert NodeId("node2") in chain.nodes
    assert len(chain.edges_from(NodeId("node1"))) == 0
    assert len(chain.edges_to(NodeId("node2"))) == 0


def test_chain_remove_edge():
    """Test removing an edge from a chain."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")
    node2 = create_mock_node(NodeId("node2"), "test:node")

    chain.add_node(node1)
    chain.add_node(node2)

    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    chain.add_edge(edge)

    # Remove edge
    chain.remove_edge(edge)

    assert len(chain.edges_from(NodeId("node1"))) == 0
    assert len(chain.edges_to(NodeId("node2"))) == 0


def test_chain_inputs():
    """Test storing and retrieving input values."""
    chain = Chain()

    # Set input value
    chain.inputs.set(NodeId("node1"), InputId(0), "test_value")

    # Get input value
    value = chain.inputs.get(NodeId("node1"), InputId(0))
    assert value == "test_value"

    # Get non-existent value
    no_value = chain.inputs.get(NodeId("node1"), InputId(1))
    assert no_value is None

    # Get from non-existent node
    no_node_value = chain.inputs.get(NodeId("node2"), InputId(0))
    assert no_node_value is None


def test_chain_nodes_with_schema_id():
    """Test filtering nodes by schema ID."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:pass_through")
    node2 = create_mock_node(NodeId("node2"), "test:pass_through")
    node3 = create_mock_node(NodeId("node3"), "test:text")

    chain.add_node(node1)
    chain.add_node(node2)
    chain.add_node(node3)

    pass_through_nodes = chain.nodes_with_schema_id("test:pass_through")
    assert len(pass_through_nodes) == 2
    assert node1 in pass_through_nodes
    assert node2 in pass_through_nodes

    text_nodes = chain.nodes_with_schema_id("test:text")
    assert len(text_nodes) == 1
    assert node3 in text_nodes

    # Non-existent schema
    no_nodes = chain.nodes_with_schema_id("test:nonexistent")
    assert len(no_nodes) == 0


def test_edge_source_equality():
    """Test EdgeSource equality."""
    source1 = EdgeSource(NodeId("node1"), OutputId(0))
    source2 = EdgeSource(NodeId("node1"), OutputId(0))
    source3 = EdgeSource(NodeId("node2"), OutputId(0))

    assert source1 == source2
    assert source1 != source3


def test_edge_target_equality():
    """Test EdgeTarget equality."""
    target1 = EdgeTarget(NodeId("node1"), InputId(0))
    target2 = EdgeTarget(NodeId("node1"), InputId(0))
    target3 = EdgeTarget(NodeId("node2"), InputId(0))

    assert target1 == target2
    assert target1 != target3


def test_edge_equality():
    """Test Edge equality."""
    edge1 = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    edge2 = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    edge3 = Edge(
        EdgeSource(NodeId("node1"), OutputId(1)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )

    assert edge1 == edge2
    assert edge1 != edge3


def test_edges_to_nonexistent_node():
    """Test getting edges to a non-existent node."""
    chain = Chain()
    edges = chain.edges_to(NodeId("nonexistent"))
    assert edges == []


def test_edges_from_nonexistent_node():
    """Test getting edges from a non-existent node."""
    chain = Chain()
    edges = chain.edges_from(NodeId("nonexistent"))
    assert edges == []
