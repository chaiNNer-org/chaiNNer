from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, List, Literal, Optional, Type, TypedDict, Union

import navi
from base_types import InputId

InputKind = Literal[
    "number",
    "slider",
    "dropdown",
    "text",
    "directory",
    "file",
    "color",
    "generic",
]


@dataclass
class InputConversion:
    """
    An input conversion can be used to convert the assigned type of an input.
    This is useful to model the changes `enforce` makes to values.

    `type` is used to declare which type is intended to be converted by this
    conversion. `convert` is the expression that does the actual conversion. It
    will be given a special parameter called `Input` that will be the value to
    convert. The `Input` parameter is guaranteed to be a non-empty sub type of
    `type`.

    Example:
    To convert all numbers to string, use this conversions:
    ```
    InputConversion("number", "toString(Input)")
    ```
    """

    type: navi.ExpressionJson
    convert: navi.ExpressionJson

    def toDict(self):
        return {
            "type": self.type,
            "convert": self.convert,
        }


class LiteralErrorValue(TypedDict):
    type: Literal["literal"]
    value: str | int | float | None


class FormattedErrorValue(TypedDict):
    type: Literal["formatted"]
    formatString: str


class UnknownErrorValue(TypedDict):
    type: Literal["unknown"]
    typeName: str
    typeModule: str


ErrorValue = Union[LiteralErrorValue, FormattedErrorValue, UnknownErrorValue]


class BaseInput:
    def __init__(
        self,
        input_type: navi.ExpressionJson,
        label: str,
        kind: InputKind = "generic",
        has_handle=True,
        associated_type: Union[Type, None] = None,
    ):
        self.input_type: navi.ExpressionJson = input_type
        self.input_conversions: List[InputConversion] = []
        self.input_adapt: navi.ExpressionJson | None = None
        self.type_definitions: str | None = None
        self.kind: InputKind = kind
        self.label: str = label
        self.optional: bool = False
        self.has_handle: bool = has_handle
        self.id: InputId = InputId(-1)
        self.associated_type: Type = associated_type

        # Optional documentation
        self.description: str | None = None
        self.examples: List[Any] | None = None

    # This is the method that should be created by each input
    def enforce(self, value: object):
        """Enforce the input type"""
        return value

    # This is the method that should be called by the processing code
    def enforce_(self, value: object | None):
        if self.optional and value is None:
            return None
        assert value is not None, (
            f"Expected value to exist, "
            f"but does not exist for {self.kind} input with type {self.input_type} and label {self.label}"
        )
        return self.enforce(value)

    def get_error_value(self, value: object) -> ErrorValue:
        if isinstance(value, Enum):
            # unwrap enum
            value = value.value

        if isinstance(value, bool):
            # bools need to be 0 or 1
            return {"type": "literal", "value": int(value)}

        if isinstance(value, (int, float, str)) or value is None:
            return {"type": "literal", "value": value}

        return {
            "type": "unknown",
            "typeName": type(value).__qualname__,
            "typeModule": type(value).__module__,
        }

    def toDict(self):
        actual_type = [self.input_type, "null"] if self.optional else self.input_type
        return {
            "id": self.id,
            "type": actual_type,
            "conversions": [c.toDict() for c in self.input_conversions],
            "adapt": self.input_adapt,
            "typeDefinitions": self.type_definitions,
            "kind": self.kind,
            "label": self.label,
            "optional": self.optional,
            "hasHandle": self.has_handle,
            "description": self.description,
            "examples": [str(e) for e in self.examples] if self.examples else None,
        }

    def with_id(self, input_id: InputId | int):
        self.id = InputId(input_id)
        return self

    def with_documentation(self, description: str, examples: List[Any] | None = None):
        self.description = description
        self.examples = examples
        return self

    def make_optional(self):
        self.optional = True
        if self.associated_type is not None:
            associated_type = self.associated_type
            self.associated_type = Optional[associated_type]
        return self

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
