from __future__ import annotations

from typing import Literal, TypedDict

from events import ExecutionErrorSource
from process import NodeExecutionError


class SuccessResponse(TypedDict):
    type: Literal["success"]
    message: str


class ErrorResponse(TypedDict):
    type: Literal["error"]
    message: str
    exception: str
    source: ExecutionErrorSource | None


class NoExecutorResponse(TypedDict):
    type: Literal["no-executor"]
    message: str


class AlreadyRunningResponse(TypedDict):
    type: Literal["already-running"]
    message: str


def success_response(message: str) -> SuccessResponse:
    return {"type": "success", "message": message}


def error_response(
    message: str,
    exception: str | Exception,
    source: ExecutionErrorSource | None = None,
) -> ErrorResponse:
    if source is None and isinstance(exception, NodeExecutionError):
        source = {
            "nodeId": exception.node_id,
            "schemaId": exception.node_data.schema_id,
            "inputs": exception.inputs,
        }
    return {
        "type": "error",
        "message": message,
        "exception": str(exception),
        "source": source,
    }


def no_executor_response(message: str) -> NoExecutorResponse:
    return {"type": "no-executor", "message": message}


def already_running_response(message: str) -> AlreadyRunningResponse:
    return {"type": "already-running", "message": message}
