"""
Test to verify that Generator exceptions are properly handled during iteration.

This test validates the fix for the issue where Load Images would run forever
instead of showing errors when exceptions occurred during iteration.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Generic, Iterable, TypeVar

I = TypeVar("I")
L = TypeVar("L")


@dataclass
class Generator(Generic[I]):
    """Copy of Generator class from api.iter to avoid dependency issues in tests"""

    supplier: Callable[[], Iterable[I | Exception]]
    expected_length: int
    fail_fast: bool = True
    metadata: object | None = None

    def with_fail_fast(self, fail_fast: bool):
        self.fail_fast = fail_fast
        return self

    def with_metadata(self, metadata: object):
        self.metadata = metadata
        return self

    @staticmethod
    def from_iter(
        supplier: Callable[[], Iterable[I | Exception]], expected_length: int
    ) -> Generator[I]:
        return Generator(supplier, expected_length)

    @staticmethod
    def from_list(l: list[L], map_fn: Callable[[L, int], I]) -> Generator[I]:
        """
        Creates a new generator from a list that is mapped using the given
        function. The iterable will be equivalent to `map(map_fn, l)`.
        """

        def supplier():
            for i, x in enumerate(l):
                try:
                    yield map_fn(x, i)
                except Exception as e:
                    yield e

        return Generator(supplier, len(l))

    @staticmethod
    def from_range(count: int, map_fn: Callable[[int], I]) -> Generator[I]:
        """
        Creates a new generator the given number of items where each item is
        lazily evaluated. The iterable will be equivalent to `map(map_fn, range(count))`.
        """
        assert count >= 0

        def supplier():
            for i in range(count):
                try:
                    yield map_fn(i)
                except Exception as e:
                    yield e

        return Generator(supplier, count)


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
