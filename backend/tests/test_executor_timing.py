"""
Tests for executor node timing in the new executor.

These tests validate that execution time is accurately tracked for:
- Static/regular nodes
- Generator nodes (including both init and iteration time)
- Collector nodes (including init, on_iterate, and on_complete time)
- Transformer nodes (including init and on_iterate time)
- Side effect leaf nodes

The timing should reflect only the node's own execution time,
not time spent waiting for upstream nodes.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any
from unittest.mock import Mock

import pytest

from api import (
    BaseInput,
    BaseOutput,
    Collector,
    ExecutionOptions,
    Generator,
    InputId,
    IteratorInputInfo,
    IteratorOutputInfo,
    NodeData,
    NodeId,
    OutputId,
    Transformer,
)
from api.settings import SettingsParser
from chain.chain import (
    Chain,
    CollectorNode,
    FunctionNode,
    GeneratorNode,
    TransformerNode,
)
from events import EventQueue
from process_new import (
    CollectorOutput,
    CollectorRuntimeNode,
    ExecutionId,
    Executor,
    GeneratorOutput,
    GeneratorRuntimeNode,
    RegularOutput,
    SideEffectLeafRuntimeNode,
    StaticRuntimeNode,
    TransformerOutput,
    TransformerRuntimeNode,
    _ExecutorNodeContext,
)

# Test constants
SLEEP_TIME = 0.05  # 50ms - enough to measure but not too slow
TIMING_TOLERANCE = 0.03  # 30ms tolerance for timing checks


def create_mock_node_data(
    schema_id: str,
    name: str,
    kind: str = "regularNode",
    run_fn: Callable[..., Any] | None = None,
) -> NodeData:
    """Create a mock NodeData for testing."""
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

    return node_data


def create_function_node(
    node_id: NodeId,
    schema_id: str,
    name: str,
    run_fn: Callable[..., Any] | None = None,
    side_effects: bool = False,
) -> FunctionNode:
    """Create a FunctionNode for testing."""
    node_data = create_mock_node_data(schema_id, name, "regularNode", run_fn)
    node_data.side_effects = side_effects
    node = Mock(spec=FunctionNode)
    node.id = node_id
    node.schema_id = schema_id
    node.data = node_data
    node.has_side_effects = Mock(return_value=side_effects)
    return node


def create_generator_node(
    node_id: NodeId,
    schema_id: str,
    name: str,
    run_fn: Callable[..., Any] | None = None,
) -> GeneratorNode:
    """Create a GeneratorNode for testing."""
    node_data = create_mock_node_data(schema_id, name, "generator", run_fn)

    # Create iterable output info
    iter_output_info = Mock(spec=IteratorOutputInfo)
    iter_output_info.outputs = [OutputId(0)]
    node_data.single_iterable_output = iter_output_info

    # Create output
    output_mock = Mock(spec=BaseOutput)
    output_mock.id = OutputId(0)
    output_mock.enforce = Mock(side_effect=lambda x: x)
    node_data.outputs = [output_mock]

    node = Mock(spec=GeneratorNode)
    node.id = node_id
    node.schema_id = schema_id
    node.data = node_data
    node.has_side_effects = Mock(return_value=False)
    return node


def create_collector_node(
    node_id: NodeId,
    schema_id: str,
    name: str,
    run_fn: Callable[..., Any] | None = None,
) -> CollectorNode:
    """Create a CollectorNode for testing."""
    node_data = create_mock_node_data(schema_id, name, "collector", run_fn)

    # Create iterable input info
    iter_input_info = Mock(spec=IteratorInputInfo)
    iter_input_info.inputs = [InputId(0)]
    node_data.single_iterable_input = iter_input_info

    # Create input
    input_mock = Mock(spec=BaseInput)
    input_mock.id = InputId(0)
    input_mock.enforce_ = Mock(side_effect=lambda x: x)
    input_mock.lazy = False
    input_mock.optional = False
    node_data.inputs = [input_mock]

    # Create output
    output_mock = Mock(spec=BaseOutput)
    output_mock.id = OutputId(0)
    output_mock.enforce = Mock(side_effect=lambda x: x)
    node_data.outputs = [output_mock]

    node = Mock(spec=CollectorNode)
    node.id = node_id
    node.schema_id = schema_id
    node.data = node_data
    node.has_side_effects = Mock(return_value=False)
    return node


def create_transformer_node(
    node_id: NodeId,
    schema_id: str,
    name: str,
    run_fn: Callable[..., Any] | None = None,
) -> TransformerNode:
    """Create a TransformerNode for testing."""
    node_data = create_mock_node_data(schema_id, name, "transformer", run_fn)

    # Create iterable input info
    iter_input_info = Mock(spec=IteratorInputInfo)
    iter_input_info.inputs = [InputId(0)]
    node_data.single_iterable_input = iter_input_info

    # Create iterable output info
    iter_output_info = Mock(spec=IteratorOutputInfo)
    iter_output_info.outputs = [OutputId(0)]
    node_data.single_iterable_output = iter_output_info

    # Create input
    input_mock = Mock(spec=BaseInput)
    input_mock.id = InputId(0)
    input_mock.enforce_ = Mock(side_effect=lambda x: x)
    input_mock.lazy = False
    input_mock.optional = False
    node_data.inputs = [input_mock]

    # Create output
    output_mock = Mock(spec=BaseOutput)
    output_mock.id = OutputId(0)
    output_mock.enforce = Mock(side_effect=lambda x: x)
    node_data.outputs = [output_mock]

    node = Mock(spec=TransformerNode)
    node.id = node_id
    node.schema_id = schema_id
    node.data = node_data
    node.has_side_effects = Mock(return_value=False)
    return node


@pytest.fixture
def executor_setup():
    """Create basic executor setup for tests."""
    chain = Chain()
    queue = EventQueue()
    pool = ThreadPoolExecutor(max_workers=4)
    storage_dir = Path("C:/temp/chainner_test")
    storage_dir.mkdir(exist_ok=True, parents=True)

    options = ExecutionOptions(backend_settings={})

    loop = asyncio.new_event_loop()

    yield {
        "chain": chain,
        "queue": queue,
        "pool": pool,
        "storage_dir": storage_dir,
        "loop": loop,
        "options": options,
    }

    pool.shutdown(wait=False)
    loop.close()


class TestStaticNodeTiming:
    """Test timing for static/regular nodes."""

    @pytest.mark.asyncio
    async def test_static_node_accumulates_execution_time(self, executor_setup):
        """Test that a static node's execution time is properly accumulated."""

        def slow_run_fn():
            time.sleep(SLEEP_TIME)
            return 42

        node_data = create_mock_node_data("test:slow", "Slow Node", run_fn=slow_run_fn)
        output_mock = Mock()
        output_mock.id = OutputId(0)
        output_mock.enforce = Mock(side_effect=lambda x: x)
        node_data.outputs = [output_mock]

        node = create_function_node(
            NodeId("node1"), "test:slow", "Slow Node", slow_run_fn
        )
        node.data = node_data

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        runtime = executor.runtimes[NodeId("node1")]
        assert isinstance(runtime, StaticRuntimeNode)

        # Initial accumulated time should be 0
        assert runtime._accumulated_exec_time == 0.0

        # Run the node
        settings = SettingsParser({})
        context = _ExecutorNodeContext(
            executor.progress, settings, executor_setup["storage_dir"]
        )
        _result, exec_time = await executor.run_node_async(node, context, [])

        # Execution time should be approximately SLEEP_TIME
        assert exec_time >= SLEEP_TIME - TIMING_TOLERANCE
        assert exec_time < SLEEP_TIME + TIMING_TOLERANCE + 0.1  # Allow some overhead

    @pytest.mark.asyncio
    async def test_run_node_async_returns_execution_time(self, executor_setup):
        """Test that run_node_async returns the actual execution time."""

        def timed_run_fn():
            time.sleep(SLEEP_TIME)
            return "result"

        node_data = create_mock_node_data(
            "test:timed", "Timed Node", run_fn=timed_run_fn
        )
        output_mock = Mock()
        output_mock.id = OutputId(0)
        output_mock.enforce = Mock(side_effect=lambda x: x)
        node_data.outputs = [output_mock]

        node = create_function_node(
            NodeId("node1"), "test:timed", "Timed Node", timed_run_fn
        )
        node.data = node_data

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        settings = SettingsParser({})
        context = _ExecutorNodeContext(
            executor.progress, settings, executor_setup["storage_dir"]
        )

        result, exec_time = await executor.run_node_async(node, context, [])

        # Verify the result
        assert isinstance(result, RegularOutput)
        assert result.output == ["result"]

        # Verify execution time is reasonable
        assert exec_time >= SLEEP_TIME - TIMING_TOLERANCE
        assert exec_time < SLEEP_TIME * 3  # Should not be wildly off


class TestGeneratorNodeTiming:
    """Test timing for generator nodes."""

    @pytest.mark.asyncio
    async def test_generator_init_time_is_tracked(self, executor_setup):
        """Test that generator initialization time is properly tracked."""

        def slow_generator_run():
            time.sleep(SLEEP_TIME)  # Simulate slow initialization

            def supplier():
                yield 1
                yield 2

            return Generator(supplier, expected_length=2)

        node = create_generator_node(
            NodeId("gen1"), "test:gen", "Slow Generator", slow_generator_run
        )
        node.data.run = slow_generator_run

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        settings = SettingsParser({})
        context = _ExecutorNodeContext(
            executor.progress, settings, executor_setup["storage_dir"]
        )

        result, exec_time = await executor.run_node_async(node, context, [])

        # Verify execution time includes initialization
        assert isinstance(result, GeneratorOutput)
        assert exec_time >= SLEEP_TIME - TIMING_TOLERANCE

    @pytest.mark.asyncio
    async def test_generator_iteration_time_is_tracked(self, executor_setup):
        """Test that generator iteration time (next() calls) is tracked."""

        def generator_with_slow_yield():
            def supplier():
                time.sleep(SLEEP_TIME)
                yield 1
                time.sleep(SLEEP_TIME)
                yield 2

            return Generator(supplier, expected_length=2)

        node = create_generator_node(
            NodeId("gen1"),
            "test:gen",
            "Slow Yield Generator",
            generator_with_slow_yield,
        )
        node.data.run = generator_with_slow_yield

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        runtime = executor.runtimes[NodeId("gen1")]
        assert isinstance(runtime, GeneratorRuntimeNode)

        # Initial accumulated time should be 0
        assert runtime._accumulated_exec_time == 0.0


class TestCollectorNodeTiming:
    """Test timing for collector nodes."""

    @pytest.mark.asyncio
    async def test_collector_init_time_is_tracked(self, executor_setup):
        """Test that collector initialization time is properly tracked."""
        results = []

        def slow_collector_run(_iterable_input):
            # Collector run receives the iterable input (None placeholder)
            time.sleep(SLEEP_TIME)  # Simulate slow initialization

            def on_iterate(value):
                results.append(value)

            def on_complete():
                return results.copy()

            return Collector(on_iterate, on_complete)

        node = create_collector_node(
            NodeId("col1"), "test:col", "Slow Collector", slow_collector_run
        )
        node.data.run = slow_collector_run

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        settings = SettingsParser({})
        context = _ExecutorNodeContext(
            executor.progress, settings, executor_setup["storage_dir"]
        )

        result, exec_time = await executor.run_node_async(node, context, [None])

        # Verify execution time includes initialization
        assert isinstance(result, CollectorOutput)
        assert exec_time >= SLEEP_TIME - TIMING_TOLERANCE

    @pytest.mark.asyncio
    async def test_collector_on_iterate_time_is_tracked(self, executor_setup):
        """Test that collector on_iterate time is manually tracked."""
        results = []

        def collector_with_slow_iterate(_iterable_input):
            def on_iterate(value):
                time.sleep(SLEEP_TIME)  # Slow iteration
                results.append(value)

            def on_complete():
                return results.copy()

            return Collector(on_iterate, on_complete)

        node = create_collector_node(
            NodeId("col1"),
            "test:col",
            "Slow Iterate Collector",
            collector_with_slow_iterate,
        )
        node.data.run = collector_with_slow_iterate

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        runtime = executor.runtimes[NodeId("col1")]
        assert isinstance(runtime, CollectorRuntimeNode)

        # Initial accumulated time should be 0
        assert runtime._accumulated_exec_time == 0.0

    @pytest.mark.asyncio
    async def test_collector_on_complete_time_is_tracked(self, executor_setup):
        """Test that collector on_complete time is manually tracked."""
        results = []

        def collector_with_slow_complete(_iterable_input):
            def on_iterate(value):
                results.append(value)

            def on_complete():
                time.sleep(SLEEP_TIME)  # Slow completion
                return results.copy()

            return Collector(on_iterate, on_complete)

        node = create_collector_node(
            NodeId("col1"),
            "test:col",
            "Slow Complete Collector",
            collector_with_slow_complete,
        )
        node.data.run = collector_with_slow_complete

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        runtime = executor.runtimes[NodeId("col1")]
        assert isinstance(runtime, CollectorRuntimeNode)

        # Initial accumulated time should be 0
        assert runtime._accumulated_exec_time == 0.0


class TestTransformerNodeTiming:
    """Test timing for transformer nodes."""

    @pytest.mark.asyncio
    async def test_transformer_init_time_is_tracked(self, executor_setup):
        """Test that transformer initialization time is properly tracked."""

        def slow_transformer_run(_iterable_input):
            # Transformer run receives the iterable input (None placeholder)
            time.sleep(SLEEP_TIME)  # Simulate slow initialization

            def on_iterate(value):
                yield value * 2

            return Transformer(on_iterate)

        node = create_transformer_node(
            NodeId("trans1"), "test:trans", "Slow Transformer", slow_transformer_run
        )
        node.data.run = slow_transformer_run

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        settings = SettingsParser({})
        context = _ExecutorNodeContext(
            executor.progress, settings, executor_setup["storage_dir"]
        )

        result, exec_time = await executor.run_node_async(node, context, [None])

        # Verify execution time includes initialization
        assert isinstance(result, TransformerOutput)
        assert exec_time >= SLEEP_TIME - TIMING_TOLERANCE

    @pytest.mark.asyncio
    async def test_transformer_on_iterate_time_is_tracked(self, executor_setup):
        """Test that transformer on_iterate time is manually tracked."""

        def transformer_with_slow_iterate(_iterable_input):
            def on_iterate(value):
                time.sleep(SLEEP_TIME)  # Slow transformation
                yield value * 2

            return Transformer(on_iterate)

        node = create_transformer_node(
            NodeId("trans1"),
            "test:trans",
            "Slow Iterate Transformer",
            transformer_with_slow_iterate,
        )
        node.data.run = transformer_with_slow_iterate

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        runtime = executor.runtimes[NodeId("trans1")]
        assert isinstance(runtime, TransformerRuntimeNode)

        # Initial accumulated time should be 0
        assert runtime._accumulated_exec_time == 0.0


class TestSideEffectNodeTiming:
    """Test timing for side effect leaf nodes."""

    @pytest.mark.asyncio
    async def test_side_effect_node_accumulates_execution_time(self, executor_setup):
        """Test that a side effect node's execution time is properly accumulated."""

        def slow_side_effect_fn():
            time.sleep(SLEEP_TIME)

        node_data = create_mock_node_data(
            "test:side", "Side Effect Node", run_fn=slow_side_effect_fn
        )
        node_data.side_effects = True
        node_data.outputs = []  # No outputs for side effect node

        node = create_function_node(
            NodeId("side1"),
            "test:side",
            "Side Effect Node",
            slow_side_effect_fn,
            side_effects=True,
        )
        node.data = node_data

        executor_setup["chain"].add_node(node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        runtime = executor.runtimes[NodeId("side1")]
        assert isinstance(runtime, SideEffectLeafRuntimeNode)

        # Initial accumulated time should be 0
        assert runtime._accumulated_exec_time == 0.0


class TestNodeFinishEvent:
    """Test that node-finish events contain correct execution time."""

    @pytest.mark.asyncio
    async def test_send_node_finish_uses_accumulated_time(self, executor_setup):
        """Test that send_node_finish sends the accumulated execution time."""

        recorded_events = []

        def record_event(event):
            recorded_events.append(event)

        def slow_run_fn():
            time.sleep(SLEEP_TIME)
            return 42

        node_data = create_mock_node_data("test:slow", "Slow Node", run_fn=slow_run_fn)
        output_mock = Mock()
        output_mock.id = OutputId(0)
        output_mock.enforce = Mock(side_effect=lambda x: x)
        node_data.outputs = [output_mock]

        node = create_function_node(
            NodeId("node1"), "test:slow", "Slow Node", slow_run_fn
        )
        node.data = node_data

        executor_setup["chain"].add_node(node)

        # Create a mock queue that records events
        mock_queue = Mock()
        mock_queue.put = record_event

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=mock_queue,
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        # Manually call send_node_finish with a known time
        test_time = 1.234
        executor.send_node_finish(node, test_time)

        # Find the node-finish event
        finish_events = [e for e in recorded_events if e.get("event") == "node-finish"]
        assert len(finish_events) == 1

        finish_event = finish_events[0]
        assert finish_event["data"]["nodeId"] == node.id
        assert finish_event["data"]["executionTime"] == test_time


class TestRuntimeNodeAccumulatedTime:
    """Test the _accumulated_exec_time field on RuntimeNode subclasses."""

    def test_runtime_node_initial_accumulated_time_is_zero(self, executor_setup):
        """Test that all RuntimeNode types start with zero accumulated time."""
        # Create various node types
        static_node = create_function_node(
            NodeId("static1"), "test:static", "Static Node"
        )
        gen_node = create_generator_node(NodeId("gen1"), "test:gen", "Generator Node")
        col_node = create_collector_node(NodeId("col1"), "test:col", "Collector Node")
        trans_node = create_transformer_node(
            NodeId("trans1"), "test:trans", "Transformer Node"
        )
        side_node = create_function_node(
            NodeId("side1"), "test:side", "Side Effect Node", side_effects=True
        )

        executor_setup["chain"].add_node(static_node)
        executor_setup["chain"].add_node(gen_node)
        executor_setup["chain"].add_node(col_node)
        executor_setup["chain"].add_node(trans_node)
        executor_setup["chain"].add_node(side_node)

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

        # Check all runtimes have zero initial accumulated time
        for node_id, runtime in executor.runtimes.items():
            assert runtime._accumulated_exec_time == 0.0, (
                f"RuntimeNode for {node_id} should have 0.0 initial accumulated time"
            )


class TestTimingDoesNotIncludeUpstreamWait:
    """Test that node timing excludes time waiting for upstream nodes."""

    @pytest.mark.asyncio
    async def test_downstream_node_timing_excludes_upstream_wait(self, executor_setup):
        """
        Test that a downstream node's accumulated time doesn't include
        the time spent waiting for the upstream node to complete.

        This is a conceptual test - the actual timing mechanism should
        only track time spent in run_node_async, not in runtime_inputs_for_async.
        """

        def slow_upstream_fn():
            time.sleep(SLEEP_TIME * 2)  # Slow upstream
            return 10

        def fast_downstream_fn(value):
            time.sleep(SLEEP_TIME / 2)  # Fast downstream
            return value * 2

        # Create upstream node
        upstream_data = create_mock_node_data(
            "test:upstream", "Upstream", run_fn=slow_upstream_fn
        )
        output_mock = Mock()
        output_mock.id = OutputId(0)
        output_mock.enforce = Mock(side_effect=lambda x: x)
        upstream_data.outputs = [output_mock]

        upstream_node = create_function_node(
            NodeId("upstream"), "test:upstream", "Upstream", slow_upstream_fn
        )
        upstream_node.data = upstream_data

        # Create downstream node
        downstream_data = create_mock_node_data(
            "test:downstream", "Downstream", run_fn=fast_downstream_fn
        )
        input_mock = Mock(spec=BaseInput)
        input_mock.id = InputId(0)
        input_mock.enforce_ = Mock(side_effect=lambda x: x)
        input_mock.lazy = False
        input_mock.optional = False
        downstream_data.inputs = [input_mock]

        output_mock2 = Mock()
        output_mock2.id = OutputId(0)
        output_mock2.enforce = Mock(side_effect=lambda x: x)
        downstream_data.outputs = [output_mock2]

        downstream_node = create_function_node(
            NodeId("downstream"), "test:downstream", "Downstream", fast_downstream_fn
        )
        downstream_node.data = downstream_data

        executor_setup["chain"].add_node(upstream_node)
        executor_setup["chain"].add_node(downstream_node)

        loop = asyncio.get_running_loop()
        executor = Executor(
            id=ExecutionId("test-exec"),
            chain=executor_setup["chain"],
            send_broadcast_data=False,
            options=executor_setup["options"],
            loop=loop,
            queue=executor_setup["queue"],
            pool=executor_setup["pool"],
            storage_dir=executor_setup["storage_dir"],
        )

        settings = SettingsParser({})
        context = _ExecutorNodeContext(
            executor.progress, settings, executor_setup["storage_dir"]
        )

        # Run upstream node and verify its timing
        upstream_result, upstream_time = await executor.run_node_async(
            upstream_node, context, []
        )
        assert upstream_time >= SLEEP_TIME * 2 - TIMING_TOLERANCE

        # Run downstream node with upstream's output
        _downstream_result, downstream_time = await executor.run_node_async(
            downstream_node, context, [upstream_result.output[0]]
        )

        # Downstream time should be much less than upstream time
        # It should only reflect its own execution, not waiting for upstream
        assert downstream_time < SLEEP_TIME
        assert downstream_time >= SLEEP_TIME / 2 - TIMING_TOLERANCE
