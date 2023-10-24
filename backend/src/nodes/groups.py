from __future__ import annotations

from enum import Enum
from typing import Iterable, List, Literal, Tuple, TypedDict, Union

import navi
from api2 import BaseInput, InputId, NestedGroup, group

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

_ConditionJson = Union[
    "_AndConditionJson",
    "_OrConditionJson",
    "_NotConditionJson",
    "_EnumConditionJson",
    "_TypeConditionJson",
]


class _AndConditionJson(TypedDict):
    kind: Literal["and"]
    items: List[_ConditionJson]


class _OrConditionJson(TypedDict):
    kind: Literal["or"]
    items: List[_ConditionJson]


class _NotConditionJson(TypedDict):
    kind: Literal["not"]
    condition: _ConditionJson


class _EnumConditionJson(TypedDict):
    kind: Literal["enum"]
    enum: InputId
    values: List[str | int]


class _TypeConditionJson(TypedDict):
    kind: Literal["type"]
    input: InputId
    condition: navi.ExpressionJson
    ifNotConnected: bool


class Condition:
    def __init__(self, value: _ConditionJson) -> None:
        self._value: _ConditionJson = value

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


def if_group(condition: Condition):
    return group("conditional", {"condition": condition.to_json()})


def if_enum_group(enum: int, condition: EnumValues):
    return if_group(Condition.enum(enum, condition))


def required(condition: Condition | None = None):
    """
    Given generic inputs (meaning of kind "generic") that are optional, this group marks them as
    being required under the given condition. If no condition is given, `True` will be used.

    In addition to the given condition, if the require group is nested within conditional group
    (`if_group` and derivatives), then the conditions of all ancestor conditional groups must also
    be met.

    Note that this group only guarantees **best effort**. It cannot guarantee that the optional
    input is going to have a value if the condition is met. You must always check `None`.

    Example:
    ```py
    if_group(someCondition)(
        required()(
            GenericInput("Foo").make_optional(),
        )
    )
    ```

    In this example, the input "Foo" is required if and only if the input is visible (by virtue of
    the parent conditional group).
    """

    if condition is None:
        condition = Condition.const(True)
    return group("required", {"condition": condition.to_json()})


def seed_group(seed_input: BaseInput):
    """
    This groups is a wrapper around the `SeedInput`. It changes its visual appearance and adds a
    little button for users to click on to generate a new seed.

    All `SeedInput`s must be wrapped in this group.

    Example:
    ```py
    seed_group(SeedInput())
    ```
    """
    return group("seed")(seed_input)


def optional_list_group(*inputs: BaseInput | NestedGroup):
    """
    This groups wraps around optional inputs and displays them as a list.

    This can be used to create nodes that have a variable number of inputs. The user will initially
    see no inputs, but can add as many inputs as the group contains. While not true varargs, this
    can be used to create a similar effect.

    See the Text Append node for an example.
    """
    return group("optional-list")(*inputs)


def linked_inputs_group(*inputs: BaseInput):
    """
    This group wraps around inputs of the same type. It ensures that all inputs have the same
    value.

    "The same type" here not only refers to the Navi type of those inputs. All possible values
    from all inputs must also be valid values for all other inputs. This typically necessitates
    that the inputs are of the same class and use the same parameters.
    """
    return group("linked-inputs")(*inputs)
