from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal

from base_types import InputId

from .. import expression

InputKind = Literal[
    "number",
    "slider",
    "dropdown",
    "text",
    "text-line",
    "directory",
    "file",
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

    type: expression.ExpressionJson
    convert: expression.ExpressionJson

    def toDict(self):
        return {
            "type": self.type,
            "convert": self.convert,
        }


class BaseInput:
    def __init__(
        self,
        input_type: expression.ExpressionJson,
        label: str,
        kind: InputKind = "generic",
        has_handle=True,
    ):
        self.input_type: expression.ExpressionJson = input_type
        self.input_conversions: List[InputConversion] = []
        self.input_adapt: expression.ExpressionJson | None = None
        self.type_definitions: str | None = None
        self.kind: InputKind = kind
        self.label: str = label
        self.optional: bool = False
        self.has_handle: bool = has_handle
        self.id: InputId = InputId(-1)

    # This is the method that should be created by each input
    def enforce(self, value):
        """Enforce the input type"""
        return value

    # This is the method that should be called by the processing code
    def enforce_(self, value):
        if self.optional and value is None:
            return None
        assert value is not None, (
            f"Expected value to exist, "
            f"but does not exist for {self.kind} input with type {self.input_type} and label {self.label}"
        )
        return self.enforce(value)

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
        }

    def with_id(self, input_id: InputId | int):
        self.id = InputId(input_id)
        return self

    def make_optional(self):
        self.optional = True
        return self

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
