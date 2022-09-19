from typing import Union, Literal
from base_types import OutputId
from .. import expression

OutputKind = Literal["image", "large-image", "text", "directory", "pytorch", "generic"]


class BaseOutput:
    def __init__(
        self,
        output_type: expression.ExpressionJson,
        label: str,
        kind: OutputKind = "generic",
        has_handle: bool = True,
    ):
        self.output_type: expression.ExpressionJson = output_type
        self.label: str = label
        self.id: OutputId = OutputId(-1)
        self.never_reason: Union[str, None] = None
        self.kind: OutputKind = kind
        self.has_handle: bool = has_handle

    def toDict(self):
        return {
            "id": self.id,
            "type": self.output_type,
            "label": self.label,
            "neverReason": self.never_reason,
            "kind": self.kind,
            "hasHandle": self.has_handle,
        }

    def with_id(self, output_id: Union[OutputId, int]):
        self.id = OutputId(output_id)
        return self

    def with_never_reason(self, reason: str):
        self.never_reason = reason
        return self

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()

    def get_broadcast_data(self, _value):
        return None
