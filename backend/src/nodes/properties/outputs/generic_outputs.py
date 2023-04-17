from __future__ import annotations

from typing import Union

from ...impl.color.color import Color
from ...utils.format import format_color_with_channels
from ...utils.seed import Seed
from .. import expression
from .base_output import BaseOutput


class NumberOutput(BaseOutput):
    def __init__(
        self,
        label: str,
        output_type: expression.ExpressionJson = "number",
    ):
        super().__init__(
            expression.intersect("number", output_type),
            label,
            associated_type=Union[int, float],
        )

    def get_broadcast_type(self, value: int | float):
        return expression.literal(value)

    def enforce(self, value) -> int | float:
        assert isinstance(value, (int, float))
        return value


class TextOutput(BaseOutput):
    def __init__(
        self,
        label: str,
        output_type: expression.ExpressionJson = "string",
    ):
        super().__init__(expression.intersect("string", output_type), label)

    def get_broadcast_type(self, value: str):
        return expression.literal(value)

    def enforce(self, value) -> str:
        assert isinstance(value, str)
        return value


def FileNameOutput(label: str = "Name", of_input: int | None = None):
    output_type = (
        "string"
        if of_input is None
        else f"splitFilePath(Input{of_input}.path).basename"
    )

    return TextOutput(label=label, output_type=output_type)


class SeedOutput(BaseOutput):
    def __init__(self, label: str = "Seed"):
        super().__init__(output_type="Seed", label=label, kind="generic")

    def enforce(self, value) -> Seed:
        assert isinstance(value, Seed)
        return value


class ColorOutput(BaseOutput):
    def __init__(
        self,
        label: str = "Color",
        color_type: expression.ExpressionJson = "Color",
        channels: int | None = None,
    ):
        super().__init__(
            output_type=expression.intersect(
                color_type, expression.Color(channels=channels)
            ),
            label=label,
            kind="generic",
        )

        self.channels = channels

    def enforce(self, value) -> Color:
        assert isinstance(value, Color)

        if self.channels is not None and value.channels != self.channels:
            expected = format_color_with_channels([self.channels])
            actual = format_color_with_channels([value.channels])
            raise ValueError(
                f"The output {self.label} was supposed to return {expected} but actually returned {actual}."
                f" This is a bug in the implementation of the node."
                f" Please report this bug."
            )

        return value
