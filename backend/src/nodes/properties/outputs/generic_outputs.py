from __future__ import annotations

from typing import Union

import navi
from api import BaseOutput

from ...impl.color.color import Color
from ...utils.format import format_color_with_channels
from ...utils.seed import Seed


class NumberOutput(BaseOutput[int | float]):
    def __init__(
        self,
        label: str,
        output_type: navi.ExpressionJson = "number",
    ):
        super().__init__(
            navi.intersect_with_error("number", output_type),
            label,
            associated_type=Union[int, float],  # noqa: UP007
        )

    def get_broadcast_type(self, value: int | float):
        return navi.literal(value)

    def enforce(self, value: object) -> int | float:
        assert isinstance(value, int | float)
        return value


class TextOutput(BaseOutput):
    def __init__(
        self,
        label: str,
        output_type: navi.ExpressionJson = "string",
    ):
        super().__init__(navi.intersect_with_error("string", output_type), label)

    def get_broadcast_type(self, value: str):
        return navi.literal(value)

    def enforce(self, value: object) -> str:
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

    def enforce(self, value: object) -> Seed:
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
            output_type=navi.intersect_with_error(
                color_type, navi.Color(channels=channels)
            ),
            label=label,
            kind="generic",
        )

        self.channels = channels

    def enforce(self, value: object) -> Color:
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


class BoolOutput(BaseOutput):
    def __init__(
        self,
        label: str = "Logical",
        *,
        output_type: navi.ExpressionJson = "bool",
    ):
        super().__init__(
            output_type=navi.intersect_with_error("bool", output_type),
            label=label,
            kind="generic",
        )


class AudioStreamOutput(BaseOutput):
    def __init__(self, label: str = "Audio Stream"):
        super().__init__(
            output_type="AudioStream",
            label=label,
            kind="generic",
        )


class AnyOutput(BaseOutput):
    def __init__(self, label: str = "Any", output_type: navi.ExpressionJson = "Any"):
        super().__init__(
            output_type=output_type,
            label=label,
            kind="generic",
        )

    def enforce(self, value: object) -> object:
        return value


class DictOutput(BaseOutput):
    """Output for a dictionary with string keys and string/number values"""

    def __init__(
        self,
        label: str = "Dictionary",
        output_type: navi.ExpressionJson = "Dict",
    ):
        super().__init__(
            output_type=navi.intersect_with_error("Dict", output_type),
            label=label,
            kind="generic",
        )

    def enforce(self, value: object) -> dict[str, str | int | float]:
        assert isinstance(value, dict)
        result: dict[str, str | int | float] = {}
        for k, v in value.items():
            assert isinstance(k, str), f"Dict keys must be strings, got {type(k)}"
            assert isinstance(
                v, str | int | float
            ), f"Dict values must be strings or numbers, got {type(v)}"
            result[k] = v
        return result
