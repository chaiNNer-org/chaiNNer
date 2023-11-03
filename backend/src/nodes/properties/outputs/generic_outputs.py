from __future__ import annotations

from typing import Union

import navi
from api import BaseOutput

from ...impl.color.color import Color
from ...utils.format import format_color_with_channels
from ...utils.seed import Seed


class NumberOutput(BaseOutput):
    def __init__(
        self,
        label: str,
        output_type: navi.ExpressionJson = "number",
    ):
        super().__init__(
            navi.intersect("number", output_type),
            label,
            associated_type=Union[int, float],
        )

    def get_broadcast_type(self, value: int | float):
        return navi.literal(value)

    def enforce(self, value) -> int | float:
        assert isinstance(value, (int, float))
        return value


class TextOutput(BaseOutput):
    def __init__(
        self,
        label: str,
        output_type: navi.ExpressionJson = "string",
    ):
        super().__init__(navi.intersect("string", output_type), label)

    def get_broadcast_type(self, value: str):
        return navi.literal(value)

    def enforce(self, value) -> str:
        assert isinstance(value, str)
        return value


def FileNameOutput(label: str = "Name", of_input: int | None = None):  # noqa: N802
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
        color_type: navi.ExpressionJson = "Color",
        channels: int | None = None,
    ):
        super().__init__(
            output_type=navi.intersect(color_type, navi.color(channels=channels)),
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


class AudioStreamOutput(BaseOutput):
    def __init__(self, label: str = "Audio Stream"):
        super().__init__(
            output_type="AudioStream",
            label=label,
            kind="generic",
        )
