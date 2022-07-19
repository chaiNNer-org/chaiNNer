from typing import Union
from .. import expression


class BaseOutput:
    def __init__(
        self,
        output_type: expression.ExpressionJson,
        label: str,
    ):
        self.output_type = output_type
        self.label = label
        self.id = None
        self.never_reason: Union[str, None] = None

    def toDict(self):
        return {
            "id": self.id,
            "type": self.output_type,
            "label": self.label,
            "neverReason": self.never_reason,
        }

    def with_id(self, output_id: int):
        self.id = output_id
        return self

    def with_never_reason(self, reason: str):
        self.never_reason = reason
        return self

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()

    def broadcast(self, value):
        return None
