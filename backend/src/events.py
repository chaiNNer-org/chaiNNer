from __future__ import annotations

import asyncio
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal, TypedDict

import navi
from api import BroadcastData, ErrorValue, InputId, IterOutputId, NodeId, OutputId

# General events


class BackendStatusData(TypedDict):
    message: str
    progress: float
    statusProgress: float | None


class BackendStatusEvent(TypedDict):
    event: Literal["backend-status", "package-install-status"]
    data: BackendStatusData


class BackendStateEvent(TypedDict):
    event: Literal["backend-started"]
    data: None


BackendEvent = BackendStatusEvent | BackendStateEvent


# Execution events


InputsDict = dict[InputId, ErrorValue]


class ExecutionErrorSource(TypedDict):
    nodeId: NodeId
    schemaId: str
    inputs: InputsDict


class ExecutionErrorData(TypedDict):
    message: str
    exception: str
    exceptionTrace: str
    source: ExecutionErrorSource | None


class ExecutionErrorEvent(TypedDict):
    event: Literal["execution-error"]
    data: ExecutionErrorData


class ChainStartData(TypedDict):
    nodes: list[str]


class ChainStartEvent(TypedDict):
    event: Literal["chain-start"]
    data: ChainStartData


class NodeStartData(TypedDict):
    nodeId: NodeId


class NodeStartEvent(TypedDict):
    event: Literal["node-start"]
    data: NodeStartData


class NodeProgressData(TypedDict):
    nodeId: NodeId
    progress: float
    """A number between 0 and 1"""
    index: int
    total: int
    eta: float


class NodeProgressUpdateEvent(TypedDict):
    event: Literal["node-progress"]
    data: NodeProgressData


class NodeBroadcastData(TypedDict):
    nodeId: NodeId
    data: dict[OutputId, BroadcastData | None]
    types: dict[OutputId, navi.ExpressionJson | None]
    sequenceTypes: dict[IterOutputId, navi.ExpressionJson] | None


class NodeBroadcastEvent(TypedDict):
    event: Literal["node-broadcast"]
    data: NodeBroadcastData


class NodeFinishData(TypedDict):
    nodeId: NodeId
    executionTime: float


class NodeFinishEvent(TypedDict):
    event: Literal["node-finish"]
    data: NodeFinishData


ExecutionEvent = (
    ExecutionErrorEvent
    | ChainStartEvent
    | NodeStartEvent
    | NodeProgressUpdateEvent
    | NodeBroadcastEvent
    | NodeFinishEvent
)


Event = ExecutionEvent | BackendEvent


class EventConsumer(ABC):
    @abstractmethod
    def put(self, event: Event) -> None: ...

    @staticmethod
    def filter(queue: EventConsumer, allowed: set[str]) -> EventConsumer:
        return _FilteredEventConsumer(queue, allowed)


@dataclass
class _FilteredEventConsumer(EventConsumer):
    queue: EventConsumer
    allowed: set[str]

    def put(self, event: Event) -> None:
        if event["event"] in self.allowed:
            self.queue.put(event)


class EventQueue(EventConsumer):
    def __init__(self):
        self.queue = asyncio.Queue()

    async def get(self) -> Event:
        return await self.queue.get()

    def put(self, event: Event) -> None:
        self.queue.put_nowait(event)

    async def wait_until_empty(self, timeout: float) -> None:
        while timeout > 0:
            if self.queue.empty():
                return
            await asyncio.sleep(0.01)
            timeout -= 0.01

    async def put_and_wait(self, event: Event, timeout: float = float("inf")) -> None:
        await self.queue.put(event)
        await self.wait_until_empty(timeout)


@dataclass
class ThrottledProgressQueue(EventConsumer):
    """
    A smart event queue that batches and throttles progress events.

    Key features:
    - Progress events are deduplicated per nodeId (only latest is kept)
    - Batched events are flushed at regular intervals (default 50ms = 20 updates/sec)
    - Non-progress events pass through immediately
    - Thread-safe for use from executor threads

    This significantly reduces CPU overhead when processing many iterations,
    as we avoid sending redundant intermediate progress updates.
    """

    queue: EventConsumer
    flush_interval: float = 0.05  # 50ms = 20 updates/sec max

    # Internal state (initialized in __post_init__)
    _pending_progress: dict[NodeId, NodeProgressUpdateEvent] = field(
        default_factory=dict, init=False
    )
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False)
    _last_flush_time: float = field(default_factory=time.monotonic, init=False)
    _flush_scheduled: bool = field(default=False, init=False)
    _loop: asyncio.AbstractEventLoop | None = field(default=None, init=False)

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Set the event loop for scheduling async flushes."""
        self._loop = loop

    def put(self, event: Event) -> None:
        event_type = event["event"]

        # Progress events get batched and deduplicated
        if event_type == "node-progress":
            self._buffer_progress(event)  # type: ignore
            return

        # Flush any pending progress before important state changes
        # This ensures progress is up-to-date before node-finish
        if event_type in ("node-finish", "chain-start", "execution-error"):
            self._flush_now()

        # All other events pass through immediately
        self.queue.put(event)

    def _buffer_progress(self, event: NodeProgressUpdateEvent) -> None:
        """Buffer a progress event, replacing any existing one for the same node."""
        node_id = event["data"]["nodeId"]

        with self._lock:
            # Always keep the latest progress for each node
            self._pending_progress[node_id] = event

            # Check if we should flush based on time
            now = time.monotonic()
            elapsed = now - self._last_flush_time

            if elapsed >= self.flush_interval:
                # Time to flush immediately
                self._flush_locked()
            elif not self._flush_scheduled and self._loop is not None:
                # Schedule a flush for later
                # Use call_soon_threadsafe since this may be called from worker threads
                self._flush_scheduled = True
                delay = self.flush_interval - elapsed
                self._loop.call_soon_threadsafe(
                    lambda d=delay: self._schedule_delayed_flush(d)
                )

    def _schedule_delayed_flush(self, delay: float) -> None:
        """Schedule a delayed flush. Must be called from the event loop thread."""
        if self._loop is not None:
            self._loop.call_later(delay, self._scheduled_flush)

    def _scheduled_flush(self) -> None:
        """Called by the event loop after the flush delay."""
        with self._lock:
            self._flush_scheduled = False
            if self._pending_progress:
                self._flush_locked()

    def _flush_locked(self) -> None:
        """Flush pending progress events. Must be called with lock held."""
        if not self._pending_progress:
            return

        # Send all pending progress events
        for event in self._pending_progress.values():
            self.queue.put(event)

        self._pending_progress.clear()
        self._last_flush_time = time.monotonic()

    def _flush_now(self) -> None:
        """Immediately flush any pending progress events."""
        with self._lock:
            self._flush_locked()

    def flush(self) -> None:
        """
        Public method to flush pending events.
        Call this when execution completes to ensure all progress is sent.
        """
        self._flush_now()

    def clear_node(self, node_id: NodeId) -> None:
        """
        Clear any pending progress for a specific node.
        Useful when a node is aborted or restarted.
        """
        with self._lock:
            self._pending_progress.pop(node_id, None)
