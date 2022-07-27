import asyncio
from typing import (
    Any,
    Dict,
    List,
    Literal,
    Optional,
    TypedDict,
    Union,
)


class FinishData(TypedDict):
    message: str


class ExecutionErrorSource(TypedDict):
    nodeId: str
    schemaId: str


class ExecutionErrorData(TypedDict):
    message: str
    exception: str
    source: Optional[ExecutionErrorSource]


class NodeFinishData(TypedDict):
    finished: List[str]


class IteratorProgressUpdateData(TypedDict):
    percent: float
    iteratorId: str
    running: Optional[List[str]]


class NodeOutputDataData(TypedDict):
    nodeId: str
    data: Dict[int, Any]


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


class NodeOutputDataEvent(TypedDict):
    event: Literal["node-output-data"]
    data: NodeOutputDataData


Event = Union[
    FinishEvent,
    ExecutionErrorEvent,
    NodeFinishEvent,
    IteratorProgressUpdateEvent,
    NodeOutputDataEvent,
]


class EventQueue:
    def __init__(self):
        self.queue = asyncio.Queue()

    async def get(self) -> Event:
        return await self.queue.get()

    async def put(self, event: Event) -> None:
        await self.queue.put(event)
