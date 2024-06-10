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


def _find(parent: dict[str, str], i: str) -> str:
    if parent[i] == i:
        return i
    else:
        parent[i] = _find(parent, parent[i])
        return parent[i]


def _union(parent: dict[str, str], rank: dict[str, int], x: str, y: str) -> None:
    root_x = _find(parent, x)
    root_y = _find(parent, y)

    if root_x != root_y:
        if rank[root_x] > rank[root_y]:
            parent[root_y] = root_x
        elif rank[root_x] < rank[root_y]:
            parent[root_x] = root_y
        else:
            parent[root_y] = root_x
            rank[root_x] += 1


def combine_sets(sets: list[set[NodeId]]) -> list[set[NodeId]]:
    elements = {elem for s in sets for elem in s}
    parent: dict[str, str] = {elem: elem for elem in elements}
    rank: dict[str, int] = {elem: 0 for elem in elements}

    for s in sets:
        s = list(s)  # noqa: PLW2901
        for i in range(1, len(s)):
            _union(parent, rank, s[i - 1], s[i])

    combined: dict[str, set[NodeId]] = {}
    for elem in elements:
        root = _find(parent, elem)
        if root in combined:
            combined[root].add(elem)
        else:
            combined[root] = {elem}

    return list(combined.values())
