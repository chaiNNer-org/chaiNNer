from __future__ import annotations

from enum import Enum

from nodes.impl.color.color import Color
from nodes.properties.inputs import ColorInput, EnumInput
from nodes.properties.outputs import NumberOutput

from .. import color_group


def _norm(n: float) -> int:
    return int(max(min(n * 255, 255), 0))


class SplitColorMode(Enum):
    NUMBER = 0
    COLOR = 1


output_navi_type = """match Input1 {
    SplitColorMode::Number => int(0..255),
    SplitColorMode::Color => Color { channels: 1 },
    _ => never }
"""


@color_group.register(
    schema_id="chainner:utility:split_color",
    name="Split Color",
    description="Split a color into its RGBA values, either as numbers or grayscale colors.",
    icon="MdColorLens",
    inputs=[
        ColorInput(),
        EnumInput(SplitColorMode, label="Mode", default=SplitColorMode.NUMBER),
    ],
    outputs=[
        NumberOutput("Red", output_type=output_navi_type),
        NumberOutput("Green", output_type=output_navi_type),
        NumberOutput("Blue", output_type=output_navi_type),
        NumberOutput("Alpha", output_type=output_navi_type),
    ],
)
def split_color_node(
    color: Color,
    mode: SplitColorMode,
) -> tuple[int, int, int, int] | tuple[Color, Color, Color, Color]:
    length = len(color.value)
    if length == 1:
        if mode == SplitColorMode.NUMBER:
            return (
                _norm(color.value[0]),
                0,
                0,
                255,
            )
        elif mode == SplitColorMode.COLOR:
            return (
                Color((color.value[0],)),
                Color((0.0,)),
                Color((0.0,)),
                Color((1.0,)),
            )
        else:
            raise AssertionError("Invalid mode")
    elif length == 3:
        if mode == SplitColorMode.NUMBER:
            return (
                _norm(color.value[2]),
                _norm(color.value[1]),
                _norm(color.value[0]),
                255,
            )
        elif mode == SplitColorMode.COLOR:
            return (
                Color((color.value[2],)),
                Color((color.value[1],)),
                Color((color.value[0],)),
                Color((1.0,)),
            )
        else:
            raise AssertionError("Invalid mode")
    elif length == 4:
        if mode == SplitColorMode.NUMBER:
            return (
                _norm(color.value[2]),
                _norm(color.value[1]),
                _norm(color.value[0]),
                _norm(color.value[3]),
            )
        elif mode == SplitColorMode.COLOR:
            return (
                Color((color.value[2],)),
                Color((color.value[1],)),
                Color((color.value[0],)),
                Color((color.value[3],)),
            )
        else:
            raise AssertionError("Invalid mode")

    else:
        raise AssertionError("Invalid color length")
