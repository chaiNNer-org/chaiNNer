from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Literal, TypedDict, Union

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


BackendEvent = Union[BackendStatusEvent, BackendStateEvent]


# Execution events


InputsDict = Dict[InputId, ErrorValue]


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


ExecutionEvent = Union[
    ExecutionErrorEvent,
    ChainStartEvent,
    NodeStartEvent,
    NodeProgressUpdateEvent,
    NodeBroadcastEvent,
    NodeFinishEvent,
]


Event = Union[ExecutionEvent, BackendEvent]


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
