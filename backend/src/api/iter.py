from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Generic, TypeVar

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


I_in = TypeVar("I_in")
O_out = TypeVar("O_out")


@dataclass
class Transformer(Generic[I_in, O_out]):
    """
    A transformer processes input sequences and yields output items.

    The supplier function captures input sequence(s) via closure and yields
    output items when called. This mirrors Generator.supplier.
    """

    supplier: Callable[[], Iterable[O_out | Exception]]
    expected_length: int | None = None
    metadata: object | None = None

    def with_metadata(self, metadata: object):
        self.metadata = metadata
        return self
