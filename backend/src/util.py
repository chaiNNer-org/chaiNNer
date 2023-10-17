import time
from typing import Callable, Tuple, TypeVar

T = TypeVar("T")


def timed_supplier(supplier: Callable[[], T]) -> Callable[[], Tuple[T, float]]:
    def wrapper():
        start = time.time()
        result = supplier()
        duration = time.time() - start
        return result, duration

    return wrapper
