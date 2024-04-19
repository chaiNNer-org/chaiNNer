from __future__ import annotations

import time
from asyncio import AbstractEventLoop
from typing import Any, Callable, Coroutine, Generic, TypeVar

T = TypeVar("T")


class Lazy(Generic[T]):
    def __init__(self, factory: Callable[[], T]):
        self._factory = factory
        self._value: tuple[T] | None = None

    @staticmethod
    def ready(value: T) -> Lazy[T]:
        lazy = Lazy(lambda: value)
        lazy._value = (value,)  # noqa: SLF001
        return lazy

    @staticmethod
    def from_coroutine(
        coroutine: Coroutine[Any, Any, T], loop: AbstractEventLoop
    ) -> Lazy[T]:
        def supplier() -> T:
            task = loop.create_task(coroutine)

            while not task.done():
                if task.cancelled():
                    raise ValueError("Task was cancelled")
                time.sleep(0.001)

            return task.result()

        return Lazy(supplier)

    @property
    def has_value(self) -> bool:
        """Returns True if the value has been computed, otherwise False."""
        return self._value is not None

    @property
    def value(self) -> T:
        if self._value is None:
            self._value = (self._factory(),)
        return self._value[0]
