from __future__ import annotations

from enum import Enum

from nodes.groups import if_enum_group
from nodes.impl.color.color import Color
from nodes.properties.inputs import EnumInput, SliderInput
from nodes.properties.outputs import ColorOutput

from .. import color_group


class ColorType(Enum):
    GRAYSCALE = 0
    RGB = 1
    RGBA = 2


@color_group.register(
    schema_id="chainner:utility:color_from_channels",
    name="Color From",
    description="Create a new color value from individual channels.",
    icon="MdColorLens",
    inputs=[
        EnumInput(ColorType, "Color Type", ColorType.RGBA),
        if_enum_group(0, ColorType.GRAYSCALE)(
            SliderInput(
                "Luma",
                minimum=0,
                maximum=255,
                default=128,
                precision=1,
                slider_step=1,
                controls_step=1,
                hide_trailing_zeros=True,
                gradient=["#000000", "#ffffff"],
            ),
        ),
        if_enum_group(0, (ColorType.RGB, ColorType.RGBA))(
            SliderInput(
                "Red",
                minimum=0,
                maximum=255,
                default=128,
                precision=1,
                slider_step=1,
                controls_step=1,
                hide_trailing_zeros=True,
                gradient=["#000000", "#ff0000"],
            ),
            SliderInput(
                "Green",
                minimum=0,
                maximum=255,
                default=128,
                precision=1,
                slider_step=1,
                controls_step=1,
                hide_trailing_zeros=True,
                gradient=["#000000", "#00ff00"],
            ),
            SliderInput(
                "Blue",
                minimum=0,
                maximum=255,
                default=128,
                precision=1,
                slider_step=1,
                controls_step=1,
                hide_trailing_zeros=True,
                gradient=["#000000", "#0000ff"],
            ),
        ),
        if_enum_group(0, ColorType.RGBA)(
            SliderInput(
                "Alpha",
                minimum=0,
                maximum=100,
                default=100,
                precision=1,
                slider_step=1,
                controls_step=1,
                unit="%",
            ),
        ),
    ],
    outputs=[
        ColorOutput(
            color_type="""
                let channels = match Input0 {
                    ColorType::Grayscale => 1,
                    ColorType::Rgb => 3,
                    ColorType::Rgba => 4,
                };
                Color { channels: channels }
            """
        )
    ],
)
def color_from(
    color_type: ColorType,
    gray: float,
    red: float,
    green: float,
    blue: float,
    alpha: float,
) -> Color:
    if color_type == ColorType.GRAYSCALE:
        return Color.gray(gray / 255)
    if color_type == ColorType.RGB:
        return Color.bgr([blue / 255, green / 255, red / 255])
    if color_type == ColorType.RGBA:
        return Color.bgra([blue / 255, green / 255, red / 255, alpha / 100])
    else:
        assert False, f"Invalid color type {color_type}"
