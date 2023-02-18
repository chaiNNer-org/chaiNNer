from typing import Literal, Optional, TypedDict, Union

from events import ExecutionErrorSource
from process import NodeExecutionError


class SuccessResponse(TypedDict):
    type: Literal["success"]
    message: str


class ErrorResponse(TypedDict):
    type: Literal["error"]
    message: str
    exception: str
    source: Optional[ExecutionErrorSource]


class NoExecutorResponse(TypedDict):
    type: Literal["no-executor"]
    message: str


class AlreadyRunningResponse(TypedDict):
    type: Literal["already-running"]
    message: str


def successResponse(message: str) -> SuccessResponse:
    return {"type": "success", "message": message}


def errorResponse(
    message: str,
    exception: Union[str, Exception],
    source: Optional[ExecutionErrorSource] = None,
) -> ErrorResponse:
    if source is None and isinstance(exception, NodeExecutionError):
        source = {
            "nodeId": exception.node.id,
            "schemaId": exception.node.schema_id,
            "inputs": exception.inputs,
        }
    return {
        "type": "error",
        "message": message,
        "exception": str(exception),
        "source": source,
    }


def noExecutorResponse(message: str) -> NoExecutorResponse:
    return {"type": "no-executor", "message": message}


def alreadyRunningResponse(message: str) -> AlreadyRunningResponse:
    return {"type": "already-running", "message": message}
