"""Tests for response helper functions."""

from __future__ import annotations

from api import NodeId
from events import ExecutionErrorSource
from response import (
    already_running_response,
    error_response,
    no_executor_response,
    success_response,
)


def test_success_response():
    """Test success response creation."""
    response = success_response()

    assert response["type"] == "success"
    assert len(response) == 1


def test_error_response_with_string():
    """Test error response with string exception."""
    response = error_response(
        message="Test error message",
        exception="Test exception",
    )

    assert response["type"] == "error"
    assert response["message"] == "Test error message"
    assert response["exception"] == "Test exception"
    assert response["source"] is None


def test_error_response_with_exception_object():
    """Test error response with Exception object."""
    exception = ValueError("Test exception")
    response = error_response(
        message="Test error message",
        exception=exception,
    )

    assert response["type"] == "error"
    assert response["message"] == "Test error message"
    assert "Test exception" in response["exception"]
    assert response["source"] is None


def test_error_response_with_source():
    """Test error response with custom source."""
    source: ExecutionErrorSource = {
        "nodeId": NodeId("node1"),
        "schemaId": "test:schema",
        "inputs": {},
    }
    response = error_response(
        message="Test error message",
        exception="Test exception",
        source=source,
    )

    assert response["type"] == "error"
    assert response["source"] == source


def test_no_executor_response():
    """Test no executor response creation."""
    response = no_executor_response()

    assert response["type"] == "no-executor"
    assert len(response) == 1


def test_already_running_response():
    """Test already running response creation."""
    message = "Executor already running"
    response = already_running_response(message)

    assert response["type"] == "already-running"
    assert response["message"] == message
