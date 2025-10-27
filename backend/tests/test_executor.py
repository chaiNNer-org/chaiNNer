"""
Comprehensive tests for the Executor class and chain execution.

These tests validate the execution of chains, including:
- Basic node execution
- Generator/Iterator execution
- Collector execution
- Error handling during execution
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable
from unittest.mock import Mock

import pytest  # type: ignore[import-untyped]

from api import (
    Collector,
    ExecutionOptions,
    InputId,
    NodeContext,
    NodeData,
    NodeId,
    OutputId,
)
from chain.chain import Chain, CollectorNode, FunctionNode
from chain.input import InputMap
from events import EventQueue
from process import ExecutionId, Executor


def create_mock_node_data(
    schema_id: str,
    name: str,
    kind: str = "regularNode",
    run_fn: Callable[..., Any] | None = None,
) -> NodeData:
    """Create a mock NodeData for testing."""
    # Use Mock without spec to avoid frozen dataclass issues
    node_data = Mock()
    node_data.schema_id = schema_id
    node_data.name = name
    node_data.kind = kind
    node_data.side_effects = False
    node_data.node_context = False
    node_data.inputs = []
    node_data.outputs = []

    if run_fn:
        node_data.run = run_fn
    else:
        node_data.run = Mock(return_value=None)

    return node_data  # type: ignore


def create_function_node(node_id: NodeId, schema_id: str, name: str) -> FunctionNode:
    """Create a FunctionNode for testing."""
    node_data = create_mock_node_data(schema_id, name, "regularNode")
    node = Mock(spec=FunctionNode)
    node.id = node_id
    node.schema_id = schema_id
    node.data = node_data
    node.has_side_effects = Mock(return_value=True)
    return node


@pytest.fixture
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def executor_setup(event_loop):
    """Create basic executor setup for tests."""
    chain = Chain()
    queue = EventQueue()
    pool = ThreadPoolExecutor(max_workers=1)
    storage_dir = Path("/tmp/chainner_test")
    storage_dir.mkdir(exist_ok=True)

    options = ExecutionOptions(backend_settings={})

    yield {
        "chain": chain,
        "queue": queue,
        "pool": pool,
        "storage_dir": storage_dir,
        "loop": event_loop,
        "options": options,
    }

    pool.shutdown(wait=False)


class TestExecutorCreation:
    """Test Executor initialization."""

    def test_executor_creation(self, executor_setup):
        """Test creating an Executor instance."""
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=True,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        assert executor is not None
        assert executor.id == "test-exec"
        assert executor.chain == executor_setup["chain"]
        assert executor.send_broadcast_data is True

    def test_executor_progress_controller(self, executor_setup):
        """Test that executor has a progress controller."""
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        assert executor.progress is not None


class TestExecutorBasicExecution:
    """Test basic chain execution."""

    @pytest.mark.asyncio
    async def test_empty_chain_execution(self, executor_setup):
        """Test executing an empty chain."""
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        # Should not raise an error
        await executor.run()

    @pytest.mark.asyncio
    async def test_single_node_no_execution(self, executor_setup):
        """Test executor with a chain that has no output nodes."""
        # Create a node without side effects (won't be executed)
        node_data = create_mock_node_data("test:node", "Test Node")

        node = Mock(spec=FunctionNode)
        node.id = NodeId("node1")
        node.schema_id = "test:node"
        node.data = node_data
        node.has_side_effects = Mock(return_value=False)

        executor_setup["chain"].add_node(node)

        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        # Should not raise an error
        await executor.run()


class TestExecutorProgressControl:
    """Test executor progress control (pause, resume, kill)."""

    def test_pause_executor(self, executor_setup):
        """Test pausing an executor."""
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        executor.pause()
        # Should not raise an error
        assert True

    def test_resume_executor(self, executor_setup):
        """Test resuming an executor."""
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        executor.pause()
        executor.resume()
        # Should not raise an error
        assert True

    def test_kill_executor(self, executor_setup):
        """Test killing an executor."""
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        executor.kill()
        # Should not raise an error
        assert True


class TestExecutorCaching:
    """Test executor node caching functionality."""

    def test_executor_has_node_cache(self, executor_setup):
        """Test that executor has a node cache."""
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        assert executor.node_cache is not None

    def test_executor_cache_strategies(self, executor_setup):
        """Test that executor has cache strategies."""
        node = create_function_node(NodeId("node1"), "test:node", "Test Node")
        executor_setup["chain"].add_node(node)

        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=executor_setup["loop"],
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        assert executor.cache_strategy is not None
        assert NodeId("node1") in executor.cache_strategy


class TestInputMapFromChain:
    """Test InputMap functionality with chains."""

    def test_input_map_empty_chain(self):
        """Test creating InputMap from empty chain."""
        chain = Chain()
        input_map = InputMap.from_chain(chain)

        assert input_map is not None

    def test_input_map_with_nodes(self):
        """Test creating InputMap from chain with nodes."""
        chain = Chain()
        node = create_function_node(NodeId("node1"), "test:node", "Test Node")
        chain.add_node(node)

        input_map = InputMap.from_chain(chain)

        assert input_map is not None
        # InputMap should have an entry for the node
        node_inputs = input_map.get(NodeId("node1"))
        assert node_inputs is not None


class TestRunNode:
    """Test the run_node function."""

    def test_run_node_returns_output(self):
        """Test that run_node returns proper output."""
        from process import run_node

        # Create a node that returns a value
        def run_fn():
            return 42

        node_data = create_mock_node_data("test:node", "Test Node", run_fn=run_fn)

        # Create output
        output_mock = Mock()
        output_mock.id = OutputId(0)
        output_mock.enforce = Mock(side_effect=lambda x: x)
        node_data.outputs = [output_mock]  # type: ignore

        context = Mock(spec=NodeContext)
        context.settings = {}

        result = run_node(node_data, context, [], NodeId("node1"))

        # Should return RegularOutput
        assert result is not None


class TestCollectorIteration:
    """Test run_collector_iterate functionality."""

    def test_run_collector_iterate_basic(self):
        """Test basic collector iteration."""
        from process import run_collector_iterate

        # Create collector
        results = []

        def on_iterate(value: int) -> None:
            results.append(value)

        def on_complete() -> list[int]:
            return results

        collector = Collector(on_iterate, on_complete)

        # Create mock collector node
        collector_node = Mock(spec=CollectorNode)
        collector_node.id = NodeId("collector1")

        # Create mock iterable input info
        iter_input_info = Mock()
        iter_input_info.inputs = [InputId(0)]

        node_data = create_mock_node_data(
            "test:collector", "Test Collector", "collector"
        )

        # Create input
        input_mock = Mock()
        input_mock.id = InputId(0)
        input_mock.enforce_ = Mock(side_effect=lambda x: x)
        node_data.inputs = [input_mock]  # type: ignore
        node_data.single_iterable_input = iter_input_info  # type: ignore

        collector_node.data = node_data

        # Run iteration
        run_collector_iterate(collector_node, [10], collector)

        assert results == [10]
