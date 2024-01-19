from __future__ import annotations

from typing import TypeVar

T = TypeVar("T")


def checked_cast(t: type[T], value: object) -> T:
    if not isinstance(value, t):
        raise ValueError(f"Value is {type(value)}, must be type {t}")
    return value
