"""Tests for the event system."""

from __future__ import annotations

import asyncio
import threading
import time

import pytest

from api import NodeId
from events import (
    BackendStatusEvent,
    ChainStartEvent,
    EventConsumer,
    EventQueue,
    ExecutionErrorEvent,
    NodeFinishEvent,
    NodeProgressUpdateEvent,
    NodeStartEvent,
    ThrottledProgressQueue,
)


def _progress_event(node_id: str, progress: float) -> NodeProgressUpdateEvent:
    return {
        "event": "node-progress",
        "data": {
            "nodeId": NodeId(node_id),
            "progress": progress,
            "index": 0,
            "total": 0,
            "eta": 0,
        },
    }


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


@pytest.mark.asyncio
async def test_throttled_progress_from_worker_thread_arrives_while_node_runs():
    """Progress sent from a worker thread is delivered before the node ends."""
    events = EventQueue()
    queue = ThrottledProgressQueue(queue=events, flush_interval=0.01)
    loop = asyncio.get_running_loop()
    queue.set_loop(loop)

    steps = [0.25, 0.5, 0.75]
    delivered = threading.Event()

    def run_node() -> list[bool]:
        # Wait for each progress event to reach the consumer before continuing,
        # the way a long-running node keeps running after set_progress().
        acks: list[bool] = []
        for progress in steps:
            time.sleep(0.03)  # longer than flush_interval
            delivered.clear()
            queue.put(_progress_event("node1", progress))
            acks.append(delivered.wait(timeout=2))
        return acks

    node = loop.run_in_executor(None, run_node)

    received: list[float] = []
    while len(received) < len(steps):
        event = await asyncio.wait_for(events.get(), timeout=5)
        assert event["event"] == "node-progress"
        received.append(event["data"]["progress"])  # type: ignore
        delivered.set()

    assert await node == [True, True, True]
    assert received == steps


@pytest.mark.asyncio
async def test_throttled_progress_flushes_before_node_finish():
    """Pending progress from a worker thread is sent before node-finish."""
    events = EventQueue()
    queue = ThrottledProgressQueue(queue=events, flush_interval=10)
    loop = asyncio.get_running_loop()
    queue.set_loop(loop)

    progress = _progress_event("node1", 0.5)
    await loop.run_in_executor(None, queue.put, progress)

    finish: NodeFinishEvent = {
        "event": "node-finish",
        "data": {"nodeId": NodeId("node1"), "executionTime": 1.0},
    }
    queue.put(finish)

    assert events.queue.get_nowait() == progress
    assert events.queue.get_nowait() == finish
    assert events.queue.empty()


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
