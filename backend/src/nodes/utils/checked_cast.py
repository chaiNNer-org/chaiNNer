from typing import Type, TypeVar

T = TypeVar("T")


def checked_cast(t: Type[T], value) -> T:
    assert isinstance(value, t)
    return value
