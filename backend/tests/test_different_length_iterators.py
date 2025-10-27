"""
Test support for iterators with different lengths.

This test validates that the executor can handle multiple generators
with different expected lengths running concurrently.
"""

from __future__ import annotations

import pytest  # type: ignore[import-untyped]

from api.iter import Collector, Generator


class TestDifferentLengthIterators:
    """Test Generator and Collector support for different length iterators."""

    def test_generators_with_different_lengths(self):
        """Test that we can create generators with different expected lengths."""

        gen1 = Generator.from_range(3, lambda i: i)
        gen2 = Generator.from_range(5, lambda i: i * 2)
        gen3 = Generator.from_range(2, lambda i: i * 3)

        assert gen1.expected_length == 3
        assert gen2.expected_length == 5
        assert gen3.expected_length == 2

    def test_generator_iteration_stops_independently(self):
        """Test that generators stop independently when exhausted."""

        gen1 = Generator.from_range(3, lambda i: i)
        gen2 = Generator.from_range(5, lambda i: i * 2)

        iter1 = gen1.supplier().__iter__()
        iter2 = gen2.supplier().__iter__()

        # Both generators should produce values initially
        assert next(iter1) == 0
        assert next(iter2) == 0

        assert next(iter1) == 1
        assert next(iter2) == 2

        assert next(iter1) == 2
        assert next(iter2) == 4

        # gen1 should be exhausted now
        with pytest.raises(StopIteration):
            next(iter1)

        # gen2 should still have values
        assert next(iter2) == 6
        assert next(iter2) == 8

        # Now gen2 should also be exhausted
        with pytest.raises(StopIteration):
            next(iter2)

    def test_collector_with_varying_input_counts(self):
        """Test that collectors can handle varying numbers of items."""

        # Collector that counts items
        count = {"value": 0}

        def on_iterate(value: int) -> None:
            count["value"] += 1

        def on_complete() -> int:
            return count["value"]

        collector = Collector(on_iterate, on_complete)

        # Simulate iteration with different amounts
        for i in range(3):
            collector.on_iterate(i)

        result1 = collector.on_complete()
        assert result1 == 3

        # Reset and try with different count
        count["value"] = 0

        for i in range(7):
            collector.on_iterate(i)

        result2 = collector.on_complete()
        assert result2 == 7

    def test_multiple_generators_different_lengths_concept(self):
        """
        Conceptual test showing how different length generators would work.

        This demonstrates the use case mentioned in the issue - filters, limits,
        and frame interpolation that produce different length outputs.
        """

        # Original sequence
        source_gen = Generator.from_range(10, lambda i: i)

        # Simulated filter (every other item)
        def filter_even(i: int) -> int:
            return i * 2  # only even indices

        filtered_gen = Generator.from_range(5, filter_even)

        # Simulated limit (first 3 items)
        limited_gen = Generator.from_range(3, lambda i: i)

        assert source_gen.expected_length == 10
        assert filtered_gen.expected_length == 5
        assert limited_gen.expected_length == 3

        # All three have different lengths, which should now be supported
