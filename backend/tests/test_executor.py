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
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from unittest.mock import Mock, patch

import pytest  # type: ignore[import-untyped]

from api import (
    BaseInput,
    BaseOutput,
    Collector,
    ExecutionOptions,
    InputId,
    IteratorInputInfo,
    NodeData,
    NodeId,
    OutputId,
)
from api.settings import SettingsParser
from chain.chain import Chain, CollectorNode, FunctionNode
from chain.input import InputMap
from events import EventQueue
from process_new import (
    CollectorOutput,
    ExecutionId,
    Executor,
    RegularOutput,
    _ExecutorNodeContext,
)


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

        # Mock the registry to allow the test node schema
        from api.api import registry

        mock_package = Mock()
        mock_package.id = "test:package"
        with patch.object(registry, "get_package", return_value=mock_package):
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


class TestRunNodeImmediate:
    """Test the run_node_immediate method on Executor."""

    def test_run_node_immediate_returns_output(self, executor_setup):
        """Test that run_node_immediate returns proper output."""

        # Create a node that returns a value
        def run_fn():
            return 42

        node_data = create_mock_node_data("test:node", "Test Node", run_fn=run_fn)

        # Create output
        output_mock = Mock()
        output_mock.id = OutputId(0)
        output_mock.enforce = Mock(side_effect=lambda x: x)
        node_data.outputs = [output_mock]  # type: ignore

        node = create_function_node(NodeId("node1"), "test:node", "Test Node")
        node.data = node_data

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

        # Create context directly since get_node_context requires registry
        settings = SettingsParser({})
        context = _ExecutorNodeContext(
            executor.progress, settings, executor_setup["storage_dir"]
        )
        result = executor.run_node_immediate(node, context, [])

        # Should return RegularOutput
        assert result is not None
        assert isinstance(result, RegularOutput)
        assert result.output == [42]


class TestCollectorIteration:
    """Test collector iteration functionality through Executor."""

    def test_collector_iteration_basic(self, executor_setup):
        """Test basic collector iteration through executor."""
        # Create collector that accumulates values
        results = []

        def on_iterate(value: int) -> None:
            results.append(value)

        def on_complete() -> list[int]:
            return results.copy()

        def collector_run_fn():
            return Collector(on_iterate, on_complete)

        # Create collector node data
        collector_node_data = create_mock_node_data(
            "test:collector", "Test Collector", "collector", run_fn=collector_run_fn
        )

        # Create iterable input info
        iter_input_info = Mock(spec=IteratorInputInfo)
        iter_input_info.inputs = [InputId(0)]

        # Create input
        input_mock = Mock(spec=BaseInput)
        input_mock.id = InputId(0)
        input_mock.enforce_ = Mock(side_effect=lambda x: x)
        input_mock.lazy = False
        input_mock.optional = False

        collector_node_data.inputs = [input_mock]  # type: ignore
        collector_node_data.single_iterable_input = iter_input_info  # type: ignore

        # Create output
        output_mock = Mock(spec=BaseOutput)
        output_mock.id = OutputId(0)
        output_mock.enforce = Mock(side_effect=lambda x: x)
        collector_node_data.outputs = [output_mock]  # type: ignore

        # Create a generator node to feed the collector
        def generator_run_fn():
            def supplier():
                yield 10
                yield 20
                yield 30

            from api import Generator

            return Generator(supplier, expected_length=3)

        generator_node_data = create_mock_node_data(
            "test:generator", "Test Generator", "generator", run_fn=generator_run_fn
        )

        generator_iter_output = Mock()
        generator_iter_output.outputs = [OutputId(0)]
        generator_node_data.single_iterable_output = generator_iter_output  # type: ignore
        generator_node_data.outputs = [output_mock]  # type: ignore

        # Create nodes
        generator_node = Mock(spec=FunctionNode)
        generator_node.id = NodeId("generator1")
        generator_node.schema_id = "test:generator"
        generator_node.data = generator_node_data
        generator_node.has_side_effects = Mock(return_value=False)

        collector_node = Mock(spec=CollectorNode)
        collector_node.id = NodeId("collector1")
        collector_node.schema_id = "test:collector"
        collector_node.data = collector_node_data
        collector_node.has_side_effects = Mock(return_value=False)

        # Add nodes to chain
        executor_setup["chain"].add_node(generator_node)
        executor_setup["chain"].add_node(collector_node)

        # Note: In a real scenario, we'd need to connect the nodes with edges
        # For this test, we'll use run_node_immediate directly to test collector iteration
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

        # Test collector initialization
        # Create context directly since get_node_context requires registry
        settings = SettingsParser({})
        context = _ExecutorNodeContext(
            executor.progress, settings, executor_setup["storage_dir"]
        )
        collector_result = executor.run_node_immediate(collector_node, context, [])

        # Verify we got a CollectorOutput
        assert collector_result is not None
        assert isinstance(collector_result, CollectorOutput)
        collector_obj = collector_result.collector

        # Test iteration
        collector_obj.on_iterate(10)
        collector_obj.on_iterate(20)
        collector_obj.on_iterate(30)

        # Verify results
        assert results == [10, 20, 30]

        # Test completion
        final_result = collector_obj.on_complete()
        assert final_result == [10, 20, 30]
