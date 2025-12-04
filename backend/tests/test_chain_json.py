"""Tests for chain JSON data structures."""

from __future__ import annotations

from api import NodeId
from chain.json import IndexEdge, JsonNode


def test_json_node_structure():
    """Test JsonNode TypedDict structure."""
    json_node: JsonNode = {
        "id": NodeId("node1"),
        "schemaId": "test:node",
        "inputs": [],
        "parent": None,
        "nodeType": "regularNode",
    }

    assert json_node["id"] == NodeId("node1")
    assert json_node["schemaId"] == "test:node"
    assert json_node["inputs"] == []
    assert json_node["parent"] is None
    assert json_node["nodeType"] == "regularNode"


def test_json_node_with_parent():
    """Test JsonNode with parent."""
    json_node: JsonNode = {
        "id": NodeId("node2"),
        "schemaId": "test:node",
        "inputs": [],
        "parent": NodeId("node1"),
        "nodeType": "regularNode",
    }

    assert json_node["parent"] == NodeId("node1")


def test_json_node_with_value_input():
    """Test JsonNode with value input."""
    json_node: JsonNode = {
        "id": NodeId("node1"),
        "schemaId": "test:node",
        "inputs": [{"type": "value", "value": 42}],
        "parent": None,
        "nodeType": "regularNode",
    }

    assert len(json_node["inputs"]) == 1
    assert json_node["inputs"][0]["type"] == "value"
    assert json_node["inputs"][0]["value"] == 42


def test_json_node_with_edge_input():
    """Test JsonNode with edge input."""
    json_node: JsonNode = {
        "id": NodeId("node2"),
        "schemaId": "test:node",
        "inputs": [{"type": "edge", "id": NodeId("node1"), "index": 0}],
        "parent": None,
        "nodeType": "regularNode",
    }

    assert len(json_node["inputs"]) == 1
    assert json_node["inputs"][0]["type"] == "edge"
    assert json_node["inputs"][0]["id"] == NodeId("node1")
    assert json_node["inputs"][0]["index"] == 0


def test_json_node_generator_type():
    """Test JsonNode with generator node type."""
    json_node: JsonNode = {
        "id": NodeId("gen1"),
        "schemaId": "test:generator",
        "inputs": [],
        "parent": None,
        "nodeType": "generator",
    }

    assert json_node["nodeType"] == "generator"


def test_json_node_collector_type():
    """Test JsonNode with collector node type."""
    json_node: JsonNode = {
        "id": NodeId("coll1"),
        "schemaId": "test:collector",
        "inputs": [],
        "parent": None,
        "nodeType": "collector",
    }

    assert json_node["nodeType"] == "collector"


def test_index_edge_creation():
    """Test creating an IndexEdge."""
    edge = IndexEdge(
        from_id=NodeId("node1"),
        from_index=0,
        to_id=NodeId("node2"),
        to_index=1,
    )

    assert edge.from_id == NodeId("node1")
    assert edge.from_index == 0
    assert edge.to_id == NodeId("node2")
    assert edge.to_index == 1


def test_json_node_multiple_inputs():
    """Test JsonNode with multiple inputs of different types."""
    json_node: JsonNode = {
        "id": NodeId("node3"),
        "schemaId": "test:node",
        "inputs": [
            {"type": "value", "value": "string_value"},
            {"type": "edge", "id": NodeId("node1"), "index": 0},
            {"type": "value", "value": 3.14},
        ],
        "parent": None,
        "nodeType": "regularNode",
    }

    assert len(json_node["inputs"]) == 3
    assert json_node["inputs"][0]["type"] == "value"
    assert json_node["inputs"][1]["type"] == "edge"
    assert json_node["inputs"][2]["type"] == "value"
