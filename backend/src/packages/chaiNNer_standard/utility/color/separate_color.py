from __future__ import annotations

from enum import Enum

from nodes.impl.color.color import Color
from nodes.properties.inputs import ColorInput, EnumInput
from nodes.properties.outputs import AnyOutput
from nodes.utils.utils import round_half_up

from .. import color_group


def _to_num(n: float, max_value: int) -> int:
    return round_half_up(max(min(n * max_value, max_value), 0))


class SeparateColorMode(Enum):
    UINT8 = 0
    PERCENT = 1
    COLOR = 2


LABELS = {
    SeparateColorMode.UINT8: "8 Bit",
    SeparateColorMode.PERCENT: "Percent",
    SeparateColorMode.COLOR: "Color",
}


output_navi_type = """
match Input1 {
    SeparateColorMode::Uint8 => int(0..255),
    SeparateColorMode::Percent => 0..100,
    SeparateColorMode::Color => Color { channels: 1 }
}
"""


@color_group.register(
    schema_id="chainner:utility:separate_color",
    name="Separate Color",
    description="Separate a color into its RGBA values, either as numbers or grayscale colors.",
    icon="MdColorLens",
    inputs=[
        ColorInput(channels=[1, 3, 4]),
        EnumInput(
            SeparateColorMode,
            label="Mode",
            default=SeparateColorMode.UINT8,
            option_labels=LABELS,
        ),
    ],
    outputs=[
        AnyOutput("Red", output_type=output_navi_type),
        AnyOutput("Green", output_type=output_navi_type),
        AnyOutput("Blue", output_type=output_navi_type),
        AnyOutput(
            "Alpha",
            output_type="""
            if Input0.channels != 4 {
                match Input1 {
                    SeparateColorMode::Uint8 => 255,
                    SeparateColorMode::Percent => 100,
                    SeparateColorMode::Color => Color { channels: 1 }
                }
            } else {
                """
            + output_navi_type
            + """
            }
        """,
        ),
    ],
)
def separate_color_node(
    color: Color,
    mode: SeparateColorMode,
) -> (
    tuple[int, int, int, int]
    | tuple[float, float, float, float]
    | tuple[Color, Color, Color, Color]
):
    length = len(color.value)
    if length == 1:
        r = color.value[0]
        g = color.value[0]
        b = color.value[0]
        a = 1
    elif length == 3:
        r = color.value[2]
        g = color.value[1]
        b = color.value[0]
        a = 1
    elif length == 4:
        r = color.value[2]
        g = color.value[1]
        b = color.value[0]
        a = color.value[3]
    else:
        raise AssertionError("Invalid number of color channels")

    if mode == SeparateColorMode.UINT8:
        return _to_num(r, 255), _to_num(g, 255), _to_num(b, 255), _to_num(a, 255)
    elif mode == SeparateColorMode.PERCENT:
        return (
            _to_num(r, 1000) / 10,
            _to_num(g, 1000) / 10,
            _to_num(b, 1000) / 10,
            _to_num(a, 1000) / 10,
        )
    elif mode == SeparateColorMode.COLOR:
        return Color.gray(r), Color.gray(g), Color.gray(b), Color.gray(a)
