"""
Test to verify that Generator exceptions are properly handled during iteration.

This test validates the fix for the issue where Load Images would run forever
instead of showing errors when exceptions occurred during iteration.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

# Import Generator directly from api.iter without triggering api.__init__
# which requires sanic and other server dependencies
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


def test_generator_yields_exception_on_error():
    """Test that Generator.from_list yields Exception objects when map_fn raises"""

    def failing_map_fn(x: int, i: int) -> int:
        if x == 2:
            raise ValueError(f"Test error for value {x}")
        return x * 2

    items = [1, 2, 3]
    gen = Generator.from_list(items, failing_map_fn)

    # Get the iterator
    iterator = gen.supplier().__iter__()

    # First value should succeed
    val1 = next(iterator)
    assert val1 == 2, "First value should be 1 * 2 = 2"

    # Second value should be an Exception
    val2 = next(iterator)
    assert isinstance(val2, Exception), "Second value should be an Exception"
    assert isinstance(val2, ValueError), "Exception should be ValueError"
    assert "Test error for value 2" in str(val2)

    # Third value should succeed
    val3 = next(iterator)
    assert val3 == 6, "Third value should be 3 * 2 = 6"


def test_generator_all_success():
    """Test that Generator.from_list works correctly when all items succeed"""

    def success_map_fn(x: int, i: int) -> int:
        return x * 2

    items = [1, 2, 3]
    gen = Generator.from_list(items, success_map_fn)

    # Get the iterator
    iterator = gen.supplier().__iter__()

    results = []
    for _ in range(3):
        val = next(iterator)
        # All values should be successful (not Exception instances)
        assert not isinstance(val, Exception), "Value should not be an Exception"
        results.append(val)

    assert results == [2, 4, 6], "All values should be doubled"


def test_generator_expected_length():
    """Test that Generator maintains expected_length correctly"""

    def map_fn(x: int, i: int) -> int:
        return x

    items = [1, 2, 3, 4, 5]
    gen = Generator.from_list(items, map_fn)

    assert gen.expected_length == 5, "Expected length should match list length"


def test_generator_fail_fast_flag():
    """Test that fail_fast flag can be set"""

    def map_fn(x: int, i: int) -> int:
        return x

    items = [1, 2, 3]
    gen = Generator.from_list(items, map_fn)

    # Default should be True
    assert gen.fail_fast is True, "Default fail_fast should be True"

    # Test setting fail_fast
    gen_with_fail_fast = gen.with_fail_fast(False)
    assert gen_with_fail_fast.fail_fast is False, "fail_fast should be False"
    assert gen_with_fail_fast is gen, "with_fail_fast should return self"


def test_generator_multiple_exceptions():
    """Test that Generator yields multiple Exception objects for multiple failures"""

    def failing_map_fn(x: int, i: int) -> int:
        if x in [2, 4]:
            raise ValueError(f"Test error for value {x}")
        return x * 2

    items = [1, 2, 3, 4, 5]
    gen = Generator.from_list(items, failing_map_fn)

    # Get the iterator
    iterator = gen.supplier().__iter__()

    # First value should succeed
    val1 = next(iterator)
    assert val1 == 2, "First value should be 1 * 2 = 2"

    # Second value should be an Exception
    val2 = next(iterator)
    assert isinstance(val2, Exception), "Second value should be an Exception"
    assert "Test error for value 2" in str(val2)

    # Third value should succeed
    val3 = next(iterator)
    assert val3 == 6, "Third value should be 3 * 2 = 6"

    # Fourth value should be an Exception
    val4 = next(iterator)
    assert isinstance(val4, Exception), "Fourth value should be an Exception"
    assert "Test error for value 4" in str(val4)

    # Fifth value should succeed
    val5 = next(iterator)
    assert val5 == 10, "Fifth value should be 5 * 2 = 10"
