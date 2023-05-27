import asyncio
from typing import Dict, List, Literal, Optional, TypedDict, Union

from base_types import InputId, NodeId, OutputId


class FinishData(TypedDict):
    message: str


class ImageInputInfo(TypedDict):
    width: int
    height: int
    channels: int


InputsDict = Dict[InputId, Union[str, int, float, ImageInputInfo, None]]


class ExecutionErrorSource(TypedDict):
    nodeId: NodeId
    schemaId: str
    inputs: InputsDict


class ExecutionErrorData(TypedDict):
    message: str
    exception: str
    source: Optional[ExecutionErrorSource]


class NodeFinishData(TypedDict):
    finished: List[NodeId]
    nodeId: NodeId
    executionTime: Optional[float]
    data: Optional[Dict[OutputId, object]]
    types: Optional[Dict[OutputId, object]]
    progressPercent: Optional[float]


class IteratorProgressUpdateData(TypedDict):
    percent: float
    index: int
    total: int
    eta: float
    iteratorId: NodeId
    running: Optional[List[NodeId]]


class BackendStatusData(TypedDict):
    message: str
    percent: int


class FinishEvent(TypedDict):
    event: Literal["finish"]
    data: FinishData


class ExecutionErrorEvent(TypedDict):
    event: Literal["execution-error"]
    data: ExecutionErrorData


class NodeFinishEvent(TypedDict):
    event: Literal["node-finish"]
    data: NodeFinishData


class IteratorProgressUpdateEvent(TypedDict):
    event: Literal["iterator-progress-update"]
    data: IteratorProgressUpdateData


class BackendStatusEvent(TypedDict):
    event: Literal["backend-status"]
    data: BackendStatusData


class BackendReadyEvent(TypedDict):
    event: Literal["backend-ready"]
    data: Dict


Event = Union[
    FinishEvent,
    ExecutionErrorEvent,
    NodeFinishEvent,
    IteratorProgressUpdateEvent,
    BackendStatusEvent,
    BackendReadyEvent,
]


class EventQueue:
    def __init__(self):
        self.queue = asyncio.Queue()

    async def get(self) -> Event:
        return await self.queue.get()

    async def put(self, event: Event) -> None:
        await self.queue.put(event)
