from __future__ import annotations

import time
from asyncio import AbstractEventLoop
from typing import Any, Callable, Coroutine, Generic, TypeVar

T = TypeVar("T")


class _Result(Generic[T]):
    """Either an okay value of T or an error value."""

    def __init__(self, value: T | None, error: Exception | None):
        self.value = value
        self.error = error

    def result(self) -> T:
        """Returns the value if it is okay, otherwise raises the error."""
        if self.error is not None:
            raise self.error
        return self.value  # type: ignore

    @property
    def is_ok(self) -> bool:
        """Returns True if the result is okay, otherwise False."""
        return self.error is None

    @staticmethod
    def ok(value: T) -> _Result[T]:
        return _Result(value, None)

    @staticmethod
    def err(error: Exception) -> _Result[T]:
        return _Result(None, error)


def _to_result(fn: Callable[[], T]) -> Callable[[], _Result[T]]:
    def wrapper() -> _Result[T]:
        try:
            return _Result.ok(fn())
        except Exception as e:
            return _Result.err(e)

    return wrapper


class Lazy(Generic[T]):
    def __init__(self, factory: Callable[[], T]):
        self._factory = _to_result(factory)
        self._value: _Result[T] | None = None
        self._evaluating = False

    @staticmethod
    def ready(value: T) -> Lazy[T]:
        lazy = Lazy(lambda: value)
        lazy._value = _Result.ok(value)  # noqa: SLF001
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
    def has_error(self) -> bool:
        """Returns True if the value has been computed and it errored instead, otherwise False."""
        return self._value is not None

    @property
    def value(self) -> T:
        if self._value is None:
            if self._evaluating:
                # wait for the value to be computed
                while self._value is None and self._evaluating:
                    time.sleep(0.001)
                if self._value is None:
                    raise ValueError("Value was not computed")
            else:
                self._evaluating = True
                try:
                    self._value = self._factory()
                finally:
                    self._evaluating = False

        return self._value.result()
