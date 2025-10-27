"""Tests for chain input mapping."""

from __future__ import annotations

from unittest.mock import Mock

from api import InputId, NodeId, OutputId
from chain.chain import (
    Chain,
    Edge,
    EdgeSource,
    EdgeTarget,
)
from chain.input import EdgeInput, InputMap, ValueInput


def create_mock_node(node_id: NodeId, schema_id: str, num_inputs: int = 1):
    """Create a mock node for testing."""
    node = Mock()
    node.id = node_id
    node.schema_id = schema_id
    mock_data = Mock()
    mock_data.kind = "regularNode"
    mock_data.side_effects = False
    # Create mock inputs
    mock_inputs = []
    for i in range(num_inputs):
        mock_input = Mock()
        mock_input.id = InputId(i)
        mock_inputs.append(mock_input)
    mock_data.inputs = mock_inputs
    # Create mock outputs
    mock_outputs = []
    for i in range(2):  # 2 outputs
        mock_output = Mock()
        mock_output.id = OutputId(i)
        mock_outputs.append(mock_output)
    mock_data.outputs = mock_outputs
    node.data = mock_data
    return node


def test_input_map_from_chain_simple():
    """Test creating InputMap from a simple chain."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")
    node2 = create_mock_node(NodeId("node2"), "test:node")

    chain.add_node(node1)
    chain.add_node(node2)

    # Add edge from node1 output 0 to node2 input 0
    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    chain.add_edge(edge)

    input_map = InputMap.from_chain(chain)

    # Check node2's input mapping
    node2_inputs = input_map.get(NodeId("node2"))
    assert len(node2_inputs) > 0
    # First input should be an EdgeInput from node1
    first_input = node2_inputs[0]
    assert isinstance(first_input, EdgeInput)
    assert first_input.id == NodeId("node1")
    assert first_input.index == 0


def test_input_map_from_chain_with_values():
    """Test creating InputMap with value inputs."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")

    chain.add_node(node1)

    # Set a value input
    chain.inputs.set(NodeId("node1"), InputId(0), "test_value")

    input_map = InputMap.from_chain(chain)

    # Check node1's input mapping
    node1_inputs = input_map.get(NodeId("node1"))
    assert len(node1_inputs) > 0
    # First input should be a ValueInput
    first_input = node1_inputs[0]
    assert isinstance(first_input, ValueInput)
    assert first_input.value == "test_value"


def test_input_map_get_nonexistent_node():
    """Test getting inputs for a non-existent node."""
    input_map = InputMap()

    try:
        input_map.get(NodeId("nonexistent"))
        raise AssertionError("Should have raised AssertionError")
    except AssertionError as e:
        assert "Unknown node id" in str(e)


def test_input_map_mixed_inputs():
    """Test InputMap with both edge and value inputs."""
    chain = Chain()
    node1 = create_mock_node(NodeId("node1"), "test:node")
    node2 = create_mock_node(NodeId("node2"), "test:node")

    chain.add_node(node1)
    chain.add_node(node2)

    # Node1 has a value input
    chain.inputs.set(NodeId("node1"), InputId(0), 42)

    # Node2 has an edge input from node1
    edge = Edge(
        EdgeSource(NodeId("node1"), OutputId(0)),
        EdgeTarget(NodeId("node2"), InputId(0)),
    )
    chain.add_edge(edge)

    input_map = InputMap.from_chain(chain)

    # Check node1's inputs
    node1_inputs = input_map.get(NodeId("node1"))
    first_input = node1_inputs[0]
    assert isinstance(first_input, ValueInput)
    assert first_input.value == 42

    # Check node2's inputs
    node2_inputs = input_map.get(NodeId("node2"))
    first_input = node2_inputs[0]
    assert isinstance(first_input, EdgeInput)
    assert first_input.id == NodeId("node1")


def test_edge_input_equality():
    """Test EdgeInput equality."""
    input1 = EdgeInput(NodeId("node1"), 0)
    input2 = EdgeInput(NodeId("node1"), 0)
    input3 = EdgeInput(NodeId("node2"), 0)
    input4 = EdgeInput(NodeId("node1"), 1)

    assert input1 == input2
    assert input1 != input3
    assert input1 != input4


def test_value_input_equality():
    """Test ValueInput equality."""
    input1 = ValueInput("value1")
    input2 = ValueInput("value1")
    input3 = ValueInput("value2")

    assert input1 == input2
    assert input1 != input3


def test_input_map_empty_chain():
    """Test creating InputMap from an empty chain."""
    chain = Chain()
    input_map = InputMap.from_chain(chain)
    assert input_map is not None
