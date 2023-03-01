from __future__ import annotations

from .. import expression
from .base_output import BaseOutput, OutputKind


class NumberOutput(BaseOutput):
    def __init__(
        self,
        label: str,
        output_type: expression.ExpressionJson = "number",
    ):
        super().__init__(expression.intersect("number", output_type), label)

    def validate(self, value) -> None:
        assert isinstance(value, (int, float))


class TextOutput(BaseOutput):
    def __init__(
        self,
        label: str,
        output_type: expression.ExpressionJson = "string",
        kind: OutputKind = "text",
    ):
        super().__init__(expression.intersect("string", output_type), label, kind=kind)

    def get_broadcast_data(self, value: str):
        return value

    def validate(self, value) -> None:
        assert isinstance(value, str)


def FileNameOutput(label: str = "Name", of_input: int | None = None):
    output_type = (
        "string"
        if of_input is None
        else f"splitFilePath(Input{of_input}.path).basename"
    )

    return TextOutput(label=label, output_type=output_type)
