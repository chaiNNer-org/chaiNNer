from .base_output import BaseOutput, OutputKind
from .. import expression


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

    def get_broadcast_data(self, value: str, _node_id: str):
        return value

    def validate(self, value) -> None:
        assert isinstance(value, str)
