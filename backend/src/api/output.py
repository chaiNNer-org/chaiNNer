from __future__ import annotations

from typing import Any, Literal

import navi

from .types import OutputId

OutputKind = Literal["image", "large-image", "tagged", "generic"]


class BaseOutput:
    def __init__(
        self,
        output_type: navi.ExpressionJson,
        label: str,
        kind: OutputKind = "generic",
        has_handle: bool = True,
        associated_type: Any = None,
    ):
        self.output_type: navi.ExpressionJson = output_type
        self.label: str = label
        self.id: OutputId = OutputId(-1)
        self.never_reason: str | None = None
        self.kind: OutputKind = kind
        self.has_handle: bool = has_handle

        self.associated_type: Any = associated_type

        # Optional documentation
        self.description: str | None = None
        self.should_suggest: bool = False

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.output_type,
            "label": self.label,
            "neverReason": self.never_reason,
            "kind": self.kind,
            "hasHandle": self.has_handle,
            "description": self.description,
            "suggest": self.should_suggest,
        }

    def with_id(self, output_id: OutputId | int):
        self.id = OutputId(output_id)
        return self

    def with_never_reason(self, reason: str):
        self.never_reason = reason
        return self

    def with_docs(self, *description: str):
        self.description = "\n\n".join(description)
        return self

    def suggest(self):
        self.should_suggest = True
        return self

    def get_broadcast_data(self, _value: object):
        return None

    def get_broadcast_type(self, _value: object) -> navi.ExpressionJson | None:
        return None

    def enforce(self, value: object) -> object:
        assert value is not None
        return value
