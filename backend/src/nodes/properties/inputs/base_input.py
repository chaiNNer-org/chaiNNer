from typing import Union, Literal
from ....base_types import InputId
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


class BaseInput:
    def __init__(
        self,
        input_type: expression.ExpressionJson,
        label: str,
        kind: InputKind = "generic",
        has_handle=True,
    ):
        self.input_type: expression.ExpressionJson = input_type
        self.input_conversion: Union[expression.ExpressionJson, None] = None
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
            "conversion": self.input_conversion,
            "kind": self.kind,
            "label": self.label,
            "optional": self.optional,
            "hasHandle": self.has_handle,
        }

    def with_id(self, input_id: Union[InputId, int]):
        self.id = InputId(input_id)
        return self

    def make_optional(self):
        self.optional = True
        return self

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
