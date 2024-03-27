from __future__ import annotations

from enum import Enum
from typing import Iterable, Literal, TypedDict, Union

import navi
from api import InputId

InputValue = Union[int, str]
EnumValues = Union[
    InputValue,
    Enum,
    Iterable[str],
    Iterable[int],
    Iterable[Enum],
]

ConditionJson = Union[
    "_AndConditionJson",
    "_OrConditionJson",
    "_NotConditionJson",
    "_EnumConditionJson",
    "_TypeConditionJson",
]


class _AndConditionJson(TypedDict):
    kind: Literal["and"]
    items: list[ConditionJson]


class _OrConditionJson(TypedDict):
    kind: Literal["or"]
    items: list[ConditionJson]


class _NotConditionJson(TypedDict):
    kind: Literal["not"]
    condition: ConditionJson


class _EnumConditionJson(TypedDict):
    kind: Literal["enum"]
    enum: InputId
    values: list[str | int]


class _TypeConditionJson(TypedDict):
    kind: Literal["type"]
    input: InputId
    condition: navi.ExpressionJson
    ifNotConnected: bool


class Condition:
    def __init__(self, value: ConditionJson) -> None:
        self._value: ConditionJson = value

    def to_json(self):
        return self._value

    def __and__(self, other: Condition) -> Condition:
        return Condition({"kind": "and", "items": [self._value, other._value]})

    def __or__(self, other: Condition) -> Condition:
        return Condition({"kind": "or", "items": [self._value, other._value]})

    def __invert__(self) -> Condition:
        return Condition({"kind": "not", "condition": self._value})

    @staticmethod
    def enum(enum: int, values: EnumValues) -> Condition:
        """
        A condition to check whether a certain dropdown/enum input has a certain value.
        """

        v: list[str | int] = []

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

        return Condition(
            {
                "kind": "enum",
                "enum": InputId(enum),
                "values": v,
            }
        )

    @staticmethod
    def bool(input_id: int, value: bool) -> Condition:
        """
        A condition to check whether a certain bool input has a certain value.
        """
        return Condition(
            {
                "kind": "enum",
                "enum": InputId(input_id),
                "values": [int(value)],
            }
        )

    @staticmethod
    def type(
        input_id: int,
        condition: navi.ExpressionJson,
        if_not_connected: bool = False,
    ) -> Condition:
        """
        A condition to check whether a certain input is compatible a certain type.
        Here "compatible" is defined as overlapping.
        """
        return Condition(
            {
                "kind": "type",
                "input": InputId(input_id),
                "condition": condition,
                "ifNotConnected": if_not_connected,
            }
        )

    @staticmethod
    def const(value: bool) -> Condition:
        if value:
            return Condition({"kind": "and", "items": []})
        return Condition({"kind": "or", "items": []})
