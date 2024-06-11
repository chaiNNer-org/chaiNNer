from __future__ import annotations

import time
from typing import Callable, TypeVar

from api.types import NodeId

T = TypeVar("T")


def timed_supplier(supplier: Callable[[], T]) -> Callable[[], tuple[T, float]]:
    def wrapper():
        start = time.time()
        result = supplier()
        duration = time.time() - start
        return result, duration

    return wrapper


###
### ChatGPT wrote the below code. I have no idea how it works, but it does.
###


def combine_sets(sets: list[set[NodeId]]) -> list[set[NodeId]]:
    combined = True
    while combined:
        combined = False
        new_sets = []
        while sets:
            current = sets.pop()
            merged = False
            for i, s in enumerate(sets):
                if current & s:  # Check for intersection
                    sets[i] = current | s  # Union
                    merged = True
                    combined = True
                    break
            if not merged:
                new_sets.append(current)
        sets = new_sets
    return sets
