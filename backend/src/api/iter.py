from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Generic, Iterable, TypeVar

I = TypeVar("I")
L = TypeVar("L")


@dataclass
class Generator(Generic[I]):
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


N = TypeVar("N")
R = TypeVar("R")


@dataclass
class Collector(Generic[N, R]):
    on_iterate: Callable[[N], None]
    on_complete: Callable[[], R]


T = TypeVar("T")


@dataclass
class Transformer(Generic[T]):
    """
    A transformer takes an iterable and transforms it into a new iterable.

    The transform function should take an iterable of items and yield transformed items.
    This allows for filtering (yielding fewer items), limiting (stopping early),
    or interpolation (yielding more items).
    """

    transform: Callable[[Iterable[T | Exception]], Iterable[T | Exception]]
