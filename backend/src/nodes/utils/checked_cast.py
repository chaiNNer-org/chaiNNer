from __future__ import annotations

from typing import TypeVar

T = TypeVar("T")


def checked_cast(t: type[T], value: object) -> T:
    assert isinstance(value, t), f"Value is {type(value)}, must be type {t}"
    return value
