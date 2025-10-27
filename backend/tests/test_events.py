"""Tests for the event system."""

from __future__ import annotations

import asyncio

import pytest

from api import NodeId
from events import (
    BackendStatusEvent,
    ChainStartEvent,
    EventConsumer,
    EventQueue,
    ExecutionErrorEvent,
    NodeFinishEvent,
    NodeStartEvent,
)


def test_event_queue_creation():
    """Test creating an EventQueue."""
    queue = EventQueue()
    assert queue is not None
    assert isinstance(queue, EventConsumer)


@pytest.mark.asyncio
async def test_event_queue_put_get():
    """Test putting and getting events from the queue."""
    queue = EventQueue()

    # Create a test event
    event: BackendStatusEvent = {
        "event": "backend-status",
        "data": {
            "message": "Test message",
            "progress": 0.5,
            "statusProgress": None,
        },
    }

    # Put event
    queue.put(event)

    # Get event
    retrieved_event = await queue.get()
    assert retrieved_event == event


@pytest.mark.asyncio
async def test_event_queue_multiple_events():
    """Test putting and getting multiple events."""
    queue = EventQueue()

    event1: NodeStartEvent = {
        "event": "node-start",
        "data": {"nodeId": NodeId("node1")},
    }

    event2: NodeFinishEvent = {
        "event": "node-finish",
        "data": {"nodeId": NodeId("node1"), "executionTime": 1.5},
    }

    # Put events
    queue.put(event1)
    queue.put(event2)

    # Get events in order
    retrieved1 = await queue.get()
    retrieved2 = await queue.get()

    assert retrieved1 == event1
    assert retrieved2 == event2


@pytest.mark.asyncio
async def test_event_queue_wait_until_empty():
    """Test waiting until queue is empty."""
    queue = EventQueue()

    # Queue should be empty initially
    await queue.wait_until_empty(timeout=0.1)

    # Put an event
    event: NodeStartEvent = {
        "event": "node-start",
        "data": {"nodeId": NodeId("node1")},
    }
    queue.put(event)

    # Create a task that consumes the event
    async def consume():
        await asyncio.sleep(0.05)
        await queue.get()

    task = asyncio.create_task(consume())

    # Wait for the queue to become empty
    await queue.wait_until_empty(timeout=1.0)
    await task


@pytest.mark.asyncio
async def test_event_consumer_filter():
    """Test filtering events."""
    queue = EventQueue()

    # Create a filtered consumer that only allows node-start events
    filtered = EventConsumer.filter(queue, {"node-start"})

    # Put a node-start event (should be allowed)
    event1: NodeStartEvent = {
        "event": "node-start",
        "data": {"nodeId": NodeId("node1")},
    }
    filtered.put(event1)

    # Put a node-finish event (should be filtered out)
    event2: NodeFinishEvent = {
        "event": "node-finish",
        "data": {"nodeId": NodeId("node1"), "executionTime": 1.5},
    }
    filtered.put(event2)

    # Only the node-start event should be in the queue
    retrieved = await queue.get()
    assert retrieved == event1

    # Queue should be empty now
    assert queue.queue.empty()


def test_chain_start_event_structure():
    """Test ChainStartEvent structure."""
    event: ChainStartEvent = {
        "event": "chain-start",
        "data": {"nodes": ["node1", "node2", "node3"]},
    }

    assert event["event"] == "chain-start"
    assert len(event["data"]["nodes"]) == 3


def test_execution_error_event_structure():
    """Test ExecutionErrorEvent structure."""
    event: ExecutionErrorEvent = {
        "event": "execution-error",
        "data": {
            "message": "Error occurred",
            "exception": "ValueError",
            "exceptionTrace": "Traceback...",
            "source": {
                "nodeId": NodeId("node1"),
                "schemaId": "test:node",
                "inputs": {},
            },
        },
    }

    assert event["event"] == "execution-error"
    assert event["data"]["message"] == "Error occurred"
    assert event["data"]["source"] is not None
    assert event["data"]["source"]["nodeId"] == NodeId("node1")


def test_backend_status_event_structure():
    """Test BackendStatusEvent structure."""
    event: BackendStatusEvent = {
        "event": "backend-status",
        "data": {
            "message": "Installing package",
            "progress": 0.75,
            "statusProgress": 0.5,
        },
    }

    assert event["event"] == "backend-status"
    assert event["data"]["progress"] == 0.75
    assert event["data"]["statusProgress"] == 0.5


def test_node_start_event_structure():
    """Test NodeStartEvent structure."""
    event: NodeStartEvent = {
        "event": "node-start",
        "data": {"nodeId": NodeId("test-node")},
    }

    assert event["event"] == "node-start"
    assert event["data"]["nodeId"] == NodeId("test-node")


def test_node_finish_event_structure():
    """Test NodeFinishEvent structure."""
    event: NodeFinishEvent = {
        "event": "node-finish",
        "data": {"nodeId": NodeId("test-node"), "executionTime": 2.5},
    }

    assert event["event"] == "node-finish"
    assert event["data"]["nodeId"] == NodeId("test-node")
    assert event["data"]["executionTime"] == 2.5
