"""Tests for chain optimization functionality."""

from __future__ import annotations

from unittest.mock import Mock

from api import InputId, NodeId, OutputId
from chain.chain import Chain, Edge, EdgeSource, EdgeTarget
from chain.optimize import optimize


def create_mock_node(
    node_id: NodeId,
    schema_id: str = "test:node",
    has_side_effects: bool = False,
) -> Mock:
    """Create a mock node for testing."""
    node = Mock()
    node.id = node_id
    node.schema_id = schema_id
    node.has_side_effects = Mock(return_value=has_side_effects)
    mock_data = Mock()
    mock_data.kind = "regularNode"
    mock_data.side_effects = has_side_effects
    mock_data.inputs = []
    mock_data.outputs = []
    node.data = mock_data
    return node


def test_optimize_empty_chain():
    """Test optimizing an empty chain does nothing."""
    chain = Chain()
    optimize(chain)
    assert len(chain.nodes) == 0


def test_optimize_single_node():
    """Test optimizing a chain with a single node."""
    chain = Chain()
    node = create_mock_node(NodeId("node1"))
    chain.add_node(node)

    # Single node with no outputs should be removed if no side effects
    optimize(chain)
    assert len(chain.nodes) == 0


def test_optimize_preserves_node_with_side_effects():
    """Test that nodes with side effects are not removed."""
    chain = Chain()
    node = create_mock_node(NodeId("node1"), has_side_effects=True)
    chain.add_node(node)

    optimize(chain)
    # Node with side effects should be preserved even without outputs
    assert NodeId("node1") in chain.nodes


def test_optimize_removes_dead_node():
    """Test that dead nodes (no outputs, no side effects) are removed."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"))
    node2 = create_mock_node(NodeId("node2"))
    node3 = create_mock_node(NodeId("node3"), has_side_effects=True)

    chain.add_node(node1)
    chain.add_node(node2)
    chain.add_node(node3)

    # Connect node1 to node3
    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node3"), InputId(0)),
    )
    chain.add_edge(edge)

    optimize(chain)

    # node1 should remain (has output to node3)
    # node2 should be removed (dead node)
    # node3 should remain (has side effects)
    assert NodeId("node1") in chain.nodes
    assert NodeId("node2") not in chain.nodes
    assert NodeId("node3") in chain.nodes


def test_optimize_chain_with_connections():
    """Test optimizing a chain with connected nodes."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"))
    node2 = create_mock_node(NodeId("node2"), has_side_effects=True)

    chain.add_node(node1)
    chain.add_node(node2)

    # Connect node1 to node2
    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    chain.add_edge(edge)

    optimize(chain)

    # Both nodes should remain
    assert NodeId("node1") in chain.nodes
    assert NodeId("node2") in chain.nodes


def test_optimize_passthrough_node():
    """Test optimization of passthrough nodes."""
    chain = Chain()

    node1 = create_mock_node(NodeId("node1"))
    passthrough = create_mock_node(NodeId("pass"), "chainner:utility:pass_through")
    node3 = create_mock_node(NodeId("node3"), has_side_effects=True)

    # Mock the passthrough node data with inputs
    mock_input = Mock()
    mock_input.id = InputId(0)
    passthrough.data.inputs = [mock_input]

    chain.add_node(node1)
    chain.add_node(passthrough)
    chain.add_node(node3)

    # Connect: node1 -> passthrough -> node3
    edge1 = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("pass"), InputId(0)),
    )
    edge2 = Edge(
        EdgeSource(NodeId("pass"), OutputId(0)),
        EdgeTarget(NodeId("node3"), InputId(0)),
    )
    chain.add_edge(edge1)
    chain.add_edge(edge2)

    optimize(chain)

    # Passthrough should be removed and node1 should connect directly to node3
    assert NodeId("node1") in chain.nodes
    assert NodeId("pass") not in chain.nodes
    assert NodeId("node3") in chain.nodes

    # Check that node1 is now connected directly to node3
    edges_from_node1 = chain.edges_from(NodeId("node1"))
    assert len(edges_from_node1) == 1
    assert edges_from_node1[0].target.id == NodeId("node3")


def test_optimize_switch_node_with_constant_index():
    """Test optimization of switch nodes with constant selection."""
    chain = Chain()

    node1 = create_mock_node(NodeId("node1"))
    node2 = create_mock_node(NodeId("node2"))
    switch = create_mock_node(NodeId("switch"), "chainner:utility:switch")
    output = create_mock_node(NodeId("output"), has_side_effects=True)

    # Mock switch node with inputs
    input0 = Mock()
    input0.id = InputId(0)
    input1 = Mock()
    input1.id = InputId(1)
    input2 = Mock()
    input2.id = InputId(2)
    switch.data.inputs = [input0, input1, input2]

    chain.add_node(node1)
    chain.add_node(node2)
    chain.add_node(switch)
    chain.add_node(output)

    # Set switch to select input 0 (node1)
    chain.inputs.set(NodeId("switch"), InputId(0), 0)

    # Connect nodes to switch inputs
    edge1 = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("switch"), InputId(1)),
    )
    edge2 = Edge(
        EdgeSource(NodeId("node2"), OutputId(0)),
        EdgeTarget(NodeId("switch"), InputId(2)),
    )
    # Connect switch to output
    edge3 = Edge(
        EdgeSource(NodeId("switch"), OutputId(0)),
        EdgeTarget(NodeId("output"), InputId(0)),
    )

    chain.add_edge(edge1)
    chain.add_edge(edge2)
    chain.add_edge(edge3)

    optimize(chain)

    # Switch should be removed and node1 should connect to output
    assert NodeId("switch") not in chain.nodes
    assert NodeId("node1") in chain.nodes
    assert NodeId("output") in chain.nodes


def test_optimize_conditional_with_constant_condition():
    """Test optimization of conditional nodes with constant condition."""
    chain = Chain()

    true_branch = create_mock_node(NodeId("true"))
    false_branch = create_mock_node(NodeId("false"))
    conditional = create_mock_node(NodeId("cond"), "chainner:utility:conditional")
    output = create_mock_node(NodeId("output"), has_side_effects=True)

    # Mock conditional node with inputs (condition, if_true, if_false)
    input0 = Mock()
    input0.id = InputId(0)
    input1 = Mock()
    input1.id = InputId(1)
    input2 = Mock()
    input2.id = InputId(2)
    conditional.data.inputs = [input0, input1, input2]

    chain.add_node(true_branch)
    chain.add_node(false_branch)
    chain.add_node(conditional)
    chain.add_node(output)

    # Set condition to True (1)
    chain.inputs.set(NodeId("cond"), InputId(0), 1)

    # Connect branches to conditional
    edge1 = Edge(
        EdgeSource(NodeId("true"), OutputId(0)),
        EdgeTarget(NodeId("cond"), InputId(1)),
    )
    edge2 = Edge(
        EdgeSource(NodeId("false"), OutputId(0)),
        EdgeTarget(NodeId("cond"), InputId(2)),
    )
    # Connect conditional to output
    edge3 = Edge(
        EdgeSource(NodeId("cond"), OutputId(0)),
        EdgeTarget(NodeId("output"), InputId(0)),
    )

    chain.add_edge(edge1)
    chain.add_edge(edge2)
    chain.add_edge(edge3)

    optimize(chain)

    # Conditional should be removed and true_branch should connect to output
    assert NodeId("cond") not in chain.nodes
    assert NodeId("true") in chain.nodes
    assert NodeId("output") in chain.nodes


def test_optimize_conditional_with_identical_branches():
    """Test optimization of conditional with identical true/false branches."""
    chain = Chain()

    source = create_mock_node(NodeId("source"))
    conditional = create_mock_node(NodeId("cond"), "chainner:utility:conditional")
    output = create_mock_node(NodeId("output"), has_side_effects=True)

    # Mock conditional node with inputs
    input0 = Mock()
    input0.id = InputId(0)
    input1 = Mock()
    input1.id = InputId(1)
    input2 = Mock()
    input2.id = InputId(2)
    conditional.data.inputs = [input0, input1, input2]

    chain.add_node(source)
    chain.add_node(conditional)
    chain.add_node(output)

    # Both branches use the same source
    edge1 = Edge(
        EdgeSource(NodeId("source"), OutputId(0)),
        EdgeTarget(NodeId("cond"), InputId(1)),
    )
    edge2 = Edge(
        EdgeSource(NodeId("source"), OutputId(0)),
        EdgeTarget(NodeId("cond"), InputId(2)),
    )
    edge3 = Edge(
        EdgeSource(NodeId("cond"), OutputId(0)),
        EdgeTarget(NodeId("output"), InputId(0)),
    )

    chain.add_edge(edge1)
    chain.add_edge(edge2)
    chain.add_edge(edge3)

    optimize(chain)

    # Conditional should be removed since both branches are identical
    assert NodeId("cond") not in chain.nodes
    assert NodeId("source") in chain.nodes
    assert NodeId("output") in chain.nodes


def test_optimize_multiple_passes():
    """Test that optimization runs multiple passes to handle cascading optimizations."""
    chain = Chain()

    # Create a chain that requires multiple passes to fully optimize
    node1 = create_mock_node(NodeId("node1"))
    node2 = create_mock_node(NodeId("node2"))
    node3 = create_mock_node(NodeId("node3"), has_side_effects=True)

    chain.add_node(node1)
    chain.add_node(node2)
    chain.add_node(node3)

    # node1 -> node2 -> node3
    edge1 = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    edge2 = Edge(
        EdgeSource(NodeId("node2"), OutputId(0)),
        EdgeTarget(NodeId("node3"), InputId(0)),
    )

    chain.add_edge(edge1)
    chain.add_edge(edge2)

    # Now remove edge2 to make node2 dead, which makes node1 dead
    chain.remove_edge(edge2)

    optimize(chain)

    # Both node1 and node2 should be removed (dead nodes)
    assert NodeId("node1") not in chain.nodes
    assert NodeId("node2") not in chain.nodes
    assert NodeId("node3") in chain.nodes
