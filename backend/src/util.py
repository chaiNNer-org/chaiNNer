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


T = TypeVar("T")


def combine_sets(set_list: list[set[T]]) -> list[set[T]]:
    """
    Combines sets in a list which have at least one intersecting value

    Example:
        in: [{1, 2}, {1, 4}, {3}, {3, 5}, {6}]
        out: [{1, 2, 4}, {3, 5}, {6}]
    Note:
        This code was written by ChatGPT. I tried to make my own algorithm for this, as well as
        find resources to help online, and was unsuccessful. From all my testing, this implementation
        seems to be both correct and performant. However, if you are familiar with this problem
        and you know a better way to do this, please submit a PR with a modification.
    """
    sets = [set(x) for x in set_list]
    combined = True
    while combined:
        combined = False
        new_sets = []
        # Process each set in the input list
        while sets:
            current = sets.pop()
            merged = False
            # Compare the current set with the remaining sets
            for i, s in enumerate(sets):
                if current & s:  # Check for intersection
                    sets[i] = current | s  # Union of sets with common elements
                    merged = True
                    combined = True  # Indicates that a merge occurred
                    break
            if not merged:
                new_sets.append(current)  # No merge, add current set to new_sets
        sets = new_sets  # Update sets with the remaining sets
    return sets
