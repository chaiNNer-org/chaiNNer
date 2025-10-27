"""
Comprehensive tests for the Generator and Collector classes.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

# Import Generator and Collector directly from api.iter without triggering api.__init__
backend_src = Path(__file__).parent.parent / "src"
spec = importlib.util.spec_from_file_location(
    "api.iter", backend_src / "api" / "iter.py"
)
assert spec is not None, "Failed to load module spec"
assert spec.loader is not None, "Module spec has no loader"
iter_module = importlib.util.module_from_spec(spec)
sys.modules["api.iter"] = iter_module
spec.loader.exec_module(iter_module)

Generator = iter_module.Generator
Collector = iter_module.Collector


class TestGeneratorFromList:
    """Test Generator.from_list functionality."""

    def test_basic_list_mapping(self):
        """Test basic list mapping with simple function."""

        def double(x: int, i: int) -> int:
            return x * 2

        gen = Generator.from_list([1, 2, 3], double)
        results = list(gen.supplier())

        assert results == [2, 4, 6]
        assert gen.expected_length == 3

    def test_empty_list(self):
        """Test Generator with empty list."""

        def identity(x: int, i: int) -> int:
            return x

        gen = Generator.from_list([], identity)
        results = list(gen.supplier())

        assert results == []
        assert gen.expected_length == 0

    def test_list_with_index(self):
        """Test that index parameter is passed correctly."""

        def add_index(x: int, i: int) -> tuple[int, int]:
            return (x, i)

        gen = Generator.from_list([10, 20, 30], add_index)
        results = list(gen.supplier())

        assert results == [(10, 0), (20, 1), (30, 2)]

    def test_exception_handling(self):
        """Test that exceptions are yielded as values."""

        def fail_on_second(x: int, i: int) -> int:
            if i == 1:
                raise ValueError("Test error")
            return x

        gen = Generator.from_list([1, 2, 3], fail_on_second)
        results = list(gen.supplier())

        assert results[0] == 1
        assert isinstance(results[1], ValueError)
        assert results[2] == 3


class TestGeneratorFromRange:
    """Test Generator.from_range functionality."""

    def test_basic_range(self):
        """Test basic range generation."""

        def square(i: int) -> int:
            return i * i

        gen = Generator.from_range(5, square)
        results = list(gen.supplier())

        assert results == [0, 1, 4, 9, 16]
        assert gen.expected_length == 5

    def test_zero_range(self):
        """Test Generator with zero count."""

        def identity(i: int) -> int:
            return i

        gen = Generator.from_range(0, identity)
        results = list(gen.supplier())

        assert results == []
        assert gen.expected_length == 0

    def test_range_exception_handling(self):
        """Test that exceptions in range are yielded."""

        def fail_on_three(i: int) -> int:
            if i == 3:
                raise RuntimeError(f"Failed at {i}")
            return i * 10

        gen = Generator.from_range(5, fail_on_three)
        results = list(gen.supplier())

        assert results[0] == 0
        assert results[1] == 10
        assert results[2] == 20
        assert isinstance(results[3], RuntimeError)
        assert results[4] == 40


class TestGeneratorFromIter:
    """Test Generator.from_iter functionality."""

    def test_basic_iterator(self):
        """Test creating generator from iterator."""

        def supplier():
            yield 1
            yield 2
            yield 3

        gen = Generator.from_iter(supplier, 3)
        results = list(gen.supplier())

        assert results == [1, 2, 3]
        assert gen.expected_length == 3

    def test_iterator_with_exceptions(self):
        """Test iterator that yields exceptions."""

        def supplier():
            yield 1
            yield ValueError("test error")
            yield 3

        gen = Generator.from_iter(supplier, 3)
        results = list(gen.supplier())

        assert results[0] == 1
        assert isinstance(results[1], ValueError)
        assert results[2] == 3


class TestGeneratorMetadata:
    """Test Generator metadata functionality."""

    def test_default_metadata(self):
        """Test that default metadata is None."""
        gen = Generator.from_range(5, lambda i: i)
        assert gen.metadata is None

    def test_set_metadata(self):
        """Test setting metadata."""
        gen = Generator.from_range(5, lambda i: i)
        metadata_obj = {"key": "value"}

        gen_with_meta = gen.with_metadata(metadata_obj)

        assert gen_with_meta.metadata == metadata_obj
        assert gen_with_meta is gen  # Should return self


class TestGeneratorFailFast:
    """Test Generator fail_fast functionality."""

    def test_default_fail_fast(self):
        """Test that default fail_fast is True."""
        gen = Generator.from_range(5, lambda i: i)
        assert gen.fail_fast is True

    def test_set_fail_fast(self):
        """Test setting fail_fast."""
        gen = Generator.from_range(5, lambda i: i)

        gen_no_fail_fast = gen.with_fail_fast(False)

        assert gen_no_fail_fast.fail_fast is False
        assert gen_no_fail_fast is gen  # Should return self

    def test_fail_fast_with_exceptions(self):
        """Test that fail_fast flag is properly set when exceptions occur.

        Note: The fail_fast flag itself doesn't change Generator behavior -
        it always yields exceptions. The flag is used by the Executor to
        determine whether to raise immediately or collect errors.
        """

        def failing_fn(i: int) -> int:
            if i == 2:
                raise ValueError(f"Error at {i}")
            return i * 10

        # Test with fail_fast=True (default)
        gen_fast = Generator.from_range(5, failing_fn)
        assert gen_fast.fail_fast is True

        results_fast = list(gen_fast.supplier())
        assert results_fast[0] == 0
        assert results_fast[1] == 10
        assert isinstance(results_fast[2], ValueError)
        assert results_fast[3] == 30
        assert results_fast[4] == 40

        # Test with fail_fast=False
        gen_slow = Generator.from_range(5, failing_fn).with_fail_fast(False)
        assert gen_slow.fail_fast is False

        results_slow = list(gen_slow.supplier())
        # Generator behavior is identical - it still yields exceptions
        assert results_slow[0] == 0
        assert results_slow[1] == 10
        assert isinstance(results_slow[2], ValueError)
        assert results_slow[3] == 30
        assert results_slow[4] == 40

        # The difference is that the Executor would raise immediately for gen_fast
        # but collect errors for gen_slow


class TestCollector:
    """Test Collector functionality."""

    def test_collector_creation(self):
        """Test creating a basic collector."""
        results = []

        def on_iterate(value: int) -> None:
            results.append(value)

        def on_complete() -> list[int]:
            return results

        collector = Collector(on_iterate, on_complete)

        assert collector.on_iterate is on_iterate
        assert collector.on_complete is on_complete

    def test_collector_iteration(self):
        """Test collector iteration."""
        accumulated = []

        def on_iterate(value: int) -> None:
            accumulated.append(value)

        def on_complete() -> int:
            return sum(accumulated)

        collector = Collector(on_iterate, on_complete)

        # Simulate iteration
        for val in [1, 2, 3, 4, 5]:
            collector.on_iterate(val)

        result = collector.on_complete()
        assert result == 15
        assert accumulated == [1, 2, 3, 4, 5]

    def test_collector_with_complex_types(self):
        """Test collector with complex types."""
        items = []

        def on_iterate(value: tuple[int, str]) -> None:
            items.append(value)

        def on_complete() -> dict[int, str]:
            return dict(items)

        collector = Collector(on_iterate, on_complete)

        # Simulate iteration
        for val in [(1, "one"), (2, "two"), (3, "three")]:
            collector.on_iterate(val)

        result = collector.on_complete()
        assert result == {1: "one", 2: "two", 3: "three"}
        assert items == [(1, "one"), (2, "two"), (3, "three")]

    def test_collector_state_accumulation(self):
        """Test that collector properly accumulates state."""
        state = {"count": 0, "total": 0}

        def on_iterate(value: int) -> None:
            state["count"] += 1
            state["total"] += value

        def on_complete() -> dict:
            return {
                "count": state["count"],
                "average": state["total"] / state["count"] if state["count"] > 0 else 0,
            }

        collector = Collector(on_iterate, on_complete)

        # Simulate iteration
        for val in [10, 20, 30, 40]:
            collector.on_iterate(val)

        result = collector.on_complete()
        assert result == {"count": 4, "average": 25.0}

    def test_collector_empty_iteration(self):
        """Test collector with no iterations."""
        accumulated = []

        def on_iterate(value: int) -> None:
            accumulated.append(value)

        def on_complete() -> list[int]:
            return accumulated

        collector = Collector(on_iterate, on_complete)

        # Complete without any iterations
        result = collector.on_complete()
        assert result == []
        assert accumulated == []


class TestGeneratorSupplierReusability:
    """Test that Generator supplier can be called multiple times."""

    def test_supplier_reusability(self):
        """Test that supplier() can be called multiple times."""

        def double(x: int, i: int) -> int:
            return x * 2

        gen = Generator.from_list([1, 2, 3], double)

        # First iteration
        results1 = list(gen.supplier())
        # Second iteration
        results2 = list(gen.supplier())

        assert results1 == [2, 4, 6]
        assert results2 == [2, 4, 6]

    def test_supplier_independence(self):
        """Test that multiple iterators from supplier are independent."""

        def identity(x: int, i: int) -> int:
            return x

        gen = Generator.from_list([1, 2, 3, 4], identity)

        iter1 = gen.supplier().__iter__()
        iter2 = gen.supplier().__iter__()

        # Advance iter1
        assert next(iter1) == 1
        assert next(iter1) == 2

        # iter2 should start from beginning
        assert next(iter2) == 1
        assert next(iter2) == 2
        assert next(iter2) == 3
