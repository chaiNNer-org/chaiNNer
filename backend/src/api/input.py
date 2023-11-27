from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Literal, Optional, TypedDict, Union

import navi

from .types import InputId, OutputId

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

    def to_dict(self):
        return {
            "type": self.type,
            "convert": self.convert,
        }


@dataclass
class IOFusion:
    output_id: OutputId


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
        has_handle: bool = True,
        associated_type: Any = None,
    ):
        self.input_type: navi.ExpressionJson = input_type
        self.input_conversions: list[InputConversion] = []
        self.input_adapt: navi.ExpressionJson | None = None
        self.type_definitions: str | None = None
        self.kind: InputKind = kind
        self.label: str = label
        self.optional: bool = False
        self.has_handle: bool = has_handle
        self.id: InputId = InputId(-1)
        self.associated_type: Any = associated_type

        self.fused: IOFusion | None = None

        # Optional documentation
        self.description: str | None = None
        self.hint: bool = False

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

    def to_dict(self):
        actual_type = [self.input_type, "null"] if self.optional else self.input_type
        return {
            "id": self.id,
            "type": actual_type,
            "conversions": [c.to_dict() for c in self.input_conversions],
            "adapt": self.input_adapt,
            "typeDefinitions": self.type_definitions,
            "kind": self.kind,
            "label": self.label,
            "optional": self.optional,
            "hasHandle": self.has_handle,
            "description": self.description,
            "hint": self.hint,
            "fused": {
                "outputId": self.fused.output_id,
            }
            if self.fused
            else None,
        }

    def with_id(self, input_id: InputId | int):
        self.id = InputId(input_id)
        return self

    def with_docs(self, *description: str, hint: bool = False):
        self.description = "\n\n".join(description)
        self.hint = hint
        return self

    def make_optional(self):
        self.optional = True
        if self.associated_type is not None:
            associated_type = self.associated_type
            self.associated_type = Optional[associated_type]
        return self

    def make_fused(self, with_output: OutputId | int = 0):
        self.fused = IOFusion(output_id=OutputId(with_output))
        return self

    def __repr__(self):
        return str(self.to_dict())

    def __iter__(self):
        yield from self.to_dict().items()
