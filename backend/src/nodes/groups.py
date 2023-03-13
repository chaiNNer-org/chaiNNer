from __future__ import annotations

from enum import Enum
from typing import Iterable, List, Literal, Tuple, TypedDict, Union

from base_types import InputId

from .group import group
from .properties.expression import ExpressionJson

InputValue = Union[int, str]
EnumValues = Union[
    InputValue,
    Enum,
    Iterable[str],
    Iterable[int],
    Iterable[Enum],
]
RawEnumValues = Union[
    InputValue, List[str], List[int], Tuple[str, ...], Tuple[int, ...]
]

_Condition = Union[
    "_AndCondition", "_OrCondition", "_NotCondition", "_EnumCondition", "_TypeCondition"
]


class _AndCondition(TypedDict):
    kind: Literal["and"]
    items: List[_Condition]


class _OrCondition(TypedDict):
    kind: Literal["or"]
    items: List[_Condition]


class _NotCondition(TypedDict):
    kind: Literal["not"]
    condition: _Condition


class _EnumCondition(TypedDict):
    kind: Literal["enum"]
    enum: InputId
    values: List[str | int]


class _TypeCondition(TypedDict):
    kind: Literal["type"]
    input: InputId
    condition: ExpressionJson


class Cond:
    def __init__(self, value: _Condition) -> None:
        self._value: _Condition = value

    def to_json(self):
        return self._value

    def __and__(self, other: Cond) -> Cond:
        return Cond({"kind": "and", "items": [self._value, other._value]})

    def __or__(self, other: Cond) -> Cond:
        return Cond({"kind": "or", "items": [self._value, other._value]})

    def __invert__(self) -> Cond:
        return Cond({"kind": "not", "condition": self._value})

    @staticmethod
    def enum(enum: int, values: EnumValues) -> Cond:
        """
        A condition to check whether a certain dropdown/enum input has a certain value.
        """

        v: List[str | int] = []

        def convert(value: int | str | Enum):
            if isinstance(value, (int, str)):
                v.append(value)
            else:
                enum_value = value.value
                assert isinstance(enum_value, (int, str))
                v.append(enum_value)

        if isinstance(values, (int, str, Enum)):
            convert(values)
        else:
            for value in values:
                convert(value)

        return Cond(
            {
                "kind": "enum",
                "enum": InputId(enum),
                "values": v,
            }
        )

    @staticmethod
    def bool(input_id: int, value: bool) -> Cond:
        """
        A condition to check whether a certain bool input has a certain value.
        """
        return Cond(
            {
                "kind": "enum",
                "enum": InputId(input_id),
                "values": [int(value)],
            }
        )

    @staticmethod
    def type(input_id: int, condition: ExpressionJson) -> Cond:
        """
        A condition to check whether a certain input is compatible a certain type.
        Here "compatible" is defined as overlapping.
        """
        return Cond(
            {
                "kind": "type",
                "input": InputId(input_id),
                "condition": condition,
            }
        )


def if_group(condition: Cond):
    return group("conditional", {"condition": condition.to_json()})
