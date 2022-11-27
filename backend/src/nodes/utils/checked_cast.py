from typing import Type, TypeVar

T = TypeVar("T")


def checked_cast(t: Type[T], value) -> T:
    assert isinstance(value, t), f"Value is {type(value)}, must be type {t}"
    return value
