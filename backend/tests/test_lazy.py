"""Tests for api.lazy module."""

from __future__ import annotations

import time

import pytest

from api.lazy import Lazy, _Result


class TestResult:
    """Tests for the _Result class."""

    def test_result_ok_creation(self):
        """Test creating an okay result."""
        result = _Result.ok(42)
        assert result.value == 42
        assert result.error is None
        assert result.is_ok is True

    def test_result_err_creation(self):
        """Test creating an error result."""
        error = ValueError("test error")
        result = _Result.err(error)
        assert result.value is None
        assert result.error == error
        assert result.is_ok is False

    def test_result_returns_value_when_ok(self):
        """Test that result() returns the value when okay."""
        result = _Result.ok(100)
        assert result.result() == 100

    def test_result_raises_error_when_not_ok(self):
        """Test that result() raises error when not okay."""
        error = ValueError("test error")
        result = _Result.err(error)
        with pytest.raises(ValueError, match="test error"):
            result.result()

    def test_result_with_different_types(self):
        """Test _Result works with different types."""
        # String
        str_result = _Result.ok("hello")
        assert str_result.result() == "hello"

        # List
        list_result = _Result.ok([1, 2, 3])
        assert list_result.result() == [1, 2, 3]

        # Dict
        dict_result = _Result.ok({"key": "value"})
        assert dict_result.result() == {"key": "value"}

        # None
        none_result = _Result.ok(None)
        assert none_result.result() is None


class TestLazy:
    """Tests for the Lazy class."""

    def test_lazy_creation(self):
        """Test creating a Lazy instance."""
        lazy = Lazy(lambda: 42)
        assert lazy.has_value is False
        assert lazy.has_error is False
        assert lazy.evaluation_time == 0

    def test_lazy_ready(self):
        """Test Lazy.ready() creates a pre-computed lazy value."""
        lazy = Lazy.ready(42)
        assert lazy.has_value is True
        assert lazy.has_error is False
        assert lazy.value == 42

    def test_lazy_value_computed_on_access(self):
        """Test that the value is computed when accessed."""
        call_count = 0

        def factory():
            nonlocal call_count
            call_count += 1
            return 42

        lazy = Lazy(factory)
        assert call_count == 0
        assert lazy.has_value is False

        value = lazy.value
        assert value == 42
        assert call_count == 1
        assert lazy.has_value is True

    def test_lazy_value_computed_only_once(self):
        """Test that the value is only computed once."""
        call_count = 0

        def factory():
            nonlocal call_count
            call_count += 1
            return 42

        lazy = Lazy(factory)

        # Access multiple times
        value1 = lazy.value
        value2 = lazy.value
        value3 = lazy.value

        assert value1 == value2 == value3 == 42
        assert call_count == 1

    def test_lazy_with_exception(self):
        """Test Lazy handles exceptions properly."""

        def factory():
            raise ValueError("test error")

        lazy = Lazy(factory)
        assert lazy.has_error is False
        assert lazy.has_value is False

        with pytest.raises(ValueError, match="test error"):
            _ = lazy.value

        assert lazy.has_error is True
        assert lazy.has_value is False

        # Accessing again should raise the same error
        with pytest.raises(ValueError, match="test error"):
            _ = lazy.value

    def test_lazy_evaluation_time(self):
        """Test that evaluation time is tracked."""

        def slow_factory():
            time.sleep(0.1)
            return 42

        lazy = Lazy(slow_factory)
        assert lazy.evaluation_time == 0

        value = lazy.value
        assert value == 42
        assert lazy.evaluation_time >= 0.1
        assert lazy.evaluation_time < 0.2  # Allow some margin

    def test_lazy_with_different_types(self):
        """Test Lazy works with different return types."""
        # String
        str_lazy = Lazy(lambda: "hello")
        assert str_lazy.value == "hello"

        # List
        list_lazy = Lazy(lambda: [1, 2, 3])
        assert list_lazy.value == [1, 2, 3]

        # Dict
        dict_lazy = Lazy(lambda: {"key": "value"})
        assert dict_lazy.value == {"key": "value"}

        # None
        none_lazy = Lazy(lambda: None)
        assert none_lazy.value is None

    def test_lazy_evaluation_time_not_incremented_on_cache_access(self):
        """Test that evaluation time is not increased on subsequent accesses."""

        def factory():
            time.sleep(0.05)
            return 42

        lazy = Lazy(factory)

        # First access
        _ = lazy.value
        first_time = lazy.evaluation_time

        # Second access should not increase time
        _ = lazy.value
        second_time = lazy.evaluation_time

        assert first_time == second_time
