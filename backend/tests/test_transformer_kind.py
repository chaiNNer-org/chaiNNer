"""
Test for transformer node kind.

This test validates that nodes can transform iterators (take an iterator
as input and output a different-length iterator).
"""

from __future__ import annotations

from api.iter import Generator


class TestTransformerKind:
    """Test the transformer node kind functionality."""

    def test_iterator_transform_concept(self):
        """
        Test the concept of transforming an iterator.

        A transformer node should be able to:
        1. Take a Generator as input
        2. Transform it (e.g., filter, limit, interpolate)
        3. Return a new Generator with different length
        """

        # Original generator with 10 items
        source_gen = Generator.from_range(10, lambda i: i)
        assert source_gen.expected_length == 10

        # Simulate a "limit" transformation - take first 5 items
        def limit_transform(gen: Generator[int], limit: int) -> Generator[int]:
            """Transform a generator by limiting the number of items."""

            def limited_supplier():
                count = 0
                for item in gen.supplier():
                    if count >= limit:
                        break
                    yield item
                    count += 1

            return Generator.from_iter(
                limited_supplier, min(limit, gen.expected_length)
            )

        limited_gen = limit_transform(source_gen, 5)
        assert limited_gen.expected_length == 5

        # Verify the limited generator produces correct values
        results = list(limited_gen.supplier())
        assert results == [0, 1, 2, 3, 4]

    def test_iterator_filter_concept(self):
        """
        Test filtering an iterator.

        A filter node would reduce the length of an iterator.
        """

        # Original generator with 10 items
        source_gen = Generator.from_range(10, lambda i: i)

        # Simulate a "filter" transformation - only even numbers
        def filter_transform(
            gen: Generator[int], predicate: callable
        ) -> Generator[int]:
            """Transform a generator by filtering items."""

            def filtered_supplier():
                for item in gen.supplier():
                    if isinstance(item, Exception):
                        yield item
                    elif predicate(item):
                        yield item

            # We can't know the exact length without iterating,
            # so we use an upper bound
            return Generator.from_iter(filtered_supplier, gen.expected_length)

        even_gen = filter_transform(source_gen, lambda x: x % 2 == 0)

        # Verify the filtered generator produces correct values
        results = list(even_gen.supplier())
        assert results == [0, 2, 4, 6, 8]

    def test_iterator_interpolate_concept(self):
        """
        Test interpolating an iterator.

        An interpolation node would increase the length of an iterator.
        """

        # Original generator with 3 items
        source_gen = Generator.from_range(3, lambda i: i * 10)  # [0, 10, 20]

        # Simulate an "interpolate" transformation - add midpoints
        def interpolate_transform(gen: Generator[int]) -> Generator[int]:
            """Transform a generator by interpolating between items."""

            def interpolated_supplier():
                items = list(gen.supplier())
                for i, item in enumerate(items):
                    if isinstance(item, Exception):
                        yield item
                        continue
                    yield item
                    # Add interpolated value between this and next item
                    if i < len(items) - 1:
                        next_item = items[i + 1]
                        if not isinstance(next_item, Exception):
                            interpolated = (item + next_item) // 2
                            yield interpolated

            # Double the length minus one (n items -> 2n - 1 items)
            new_length = max(0, gen.expected_length * 2 - 1)
            return Generator.from_iter(interpolated_supplier, new_length)

        interpolated_gen = interpolate_transform(source_gen)
        assert interpolated_gen.expected_length == 5  # 3*2 - 1 = 5

        # Verify the interpolated generator produces correct values
        results = list(interpolated_gen.supplier())
        assert results == [0, 5, 10, 15, 20]
