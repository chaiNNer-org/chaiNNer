from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Literal, TypedDict, Union

from attr import dataclass

from api import ErrorValue, InputId, NodeId, OutputId

# Data of events


class FinishData(TypedDict):
    message: str


InputsDict = Dict[InputId, ErrorValue]


class ExecutionErrorSource(TypedDict):
    nodeId: NodeId
    schemaId: str
    inputs: InputsDict


class ExecutionErrorData(TypedDict):
    message: str
    exception: str
    source: ExecutionErrorSource | None


class NodeFinishData(TypedDict):
    nodeId: NodeId
    executionTime: float | None
    data: dict[OutputId, object] | None
    types: dict[OutputId, object] | None
    progressPercent: float | None


class NodeStartData(TypedDict):
    nodeId: NodeId


class NodeProgressUpdateData(TypedDict):
    percent: float
    index: int
    total: int
    eta: float
    nodeId: NodeId


class BackendStatusData(TypedDict):
    message: str
    progress: float
    statusProgress: float | None


# Events


class FinishEvent(TypedDict):
    event: Literal["finish"]
    data: FinishData


class ExecutionErrorEvent(TypedDict):
    event: Literal["execution-error"]
    data: ExecutionErrorData


class NodeFinishEvent(TypedDict):
    event: Literal["node-finish"]
    data: NodeFinishData


class NodeStartEvent(TypedDict):
    event: Literal["node-start"]
    data: NodeStartData


class NodeProgressUpdateEvent(TypedDict):
    event: Literal["node-progress-update"]
    data: NodeProgressUpdateData


class BackendStatusEvent(TypedDict):
    event: Literal["backend-status"]
    data: BackendStatusData


class BackendStateEvent(TypedDict):
    event: Literal["backend-ready"] | Literal["backend-started"]
    data: None


Event = Union[
    FinishEvent,
    ExecutionErrorEvent,
    NodeFinishEvent,
    NodeStartEvent,
    NodeProgressUpdateEvent,
    BackendStatusEvent,
    BackendStateEvent,
]


class EventConsumer(ABC):
    @abstractmethod
    async def put(self, event: Event) -> None:
        ...

    @staticmethod
    def filter(queue: EventConsumer, allowed: set[str]) -> EventConsumer:
        return _FilteredEventConsumer(queue, allowed)


@dataclass
class _FilteredEventConsumer(EventConsumer):
    queue: EventConsumer
    allowed: set[str]

    async def put(self, event: Event) -> None:
        if event["event"] in self.allowed:
            await self.queue.put(event)


class EventQueue(EventConsumer):
    def __init__(self):
        self.queue = asyncio.Queue()

    async def get(self) -> Event:
        return await self.queue.get()

    async def put(self, event: Event) -> None:
        await self.queue.put(event)

    async def wait_until_empty(self, timeout: float) -> None:
        while timeout > 0:
            if self.queue.empty():
                return
            await asyncio.sleep(0.01)
            timeout -= 0.01

    async def put_and_wait(self, event: Event, timeout: float = float("inf")) -> None:
        await self.queue.put(event)
        await self.wait_until_empty(timeout)
