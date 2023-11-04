from __future__ import annotations

import time
from typing import Callable, TypeVar

T = TypeVar("T")


def timed_supplier(supplier: Callable[[], T]) -> Callable[[], tuple[T, float]]:
    def wrapper():
        start = time.time()
        result = supplier()
        duration = time.time() - start
        return result, duration

    return wrapper
