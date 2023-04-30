from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group
from nodes.impl.color.color import Color
from nodes.impl.gradients import (
    conic_gradient,
    diagonal_gradient,
    horizontal_gradient,
    radial_gradient,
    vertical_gradient,
)
from nodes.impl.image_utils import as_target_channels
from nodes.properties import expression
from nodes.properties.inputs import (
    BoolInput,
    ColorInput,
    EnumInput,
    NumberInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput

from .. import create_images_group


class GradientStyle(Enum):
    HORIZONTAL = "Horizontal"
    VERTICAL = "Vertical"
    DIAGONAL = "Diagonal"
    RADIAL = "Radial"
    CONIC = "Conic"


@create_images_group.register(
    schema_id="chainner:image:create_gradient",
    name="Create Gradient",
    description="Create an image with a gradient.",
    icon="MdFormatColorFill",
    inputs=[
        NumberInput("Width", minimum=1, unit="px", default=64),
        NumberInput("Height", minimum=1, unit="px", default=64),
        ColorInput("Color 1", default=Color.gray(0)).with_id(9),
        ColorInput("Color 2", default=Color.gray(1)).with_id(10),
        BoolInput("Reverse", default=False).with_id(2),
        EnumInput(GradientStyle, default_value=GradientStyle.HORIZONTAL).with_id(3),
        if_enum_group(3, GradientStyle.DIAGONAL)(
            SliderInput(
                "Angle",
                minimum=0,
                maximum=360,
                default=45,
                unit="deg",
            ).with_id(4),
            NumberInput(
                "Width",
                minimum=0,
                default=100,
                unit="px",
            ).with_id(5),
        ),
        if_enum_group(3, GradientStyle.RADIAL)(
            SliderInput(
                "Inner Radius",
                minimum=0,
                maximum=100,
                default=0,
                unit="%",
            ).with_id(6),
            SliderInput(
                "Outer Radius",
                minimum=0,
                maximum=100,
                default=100,
                unit="%",
            ).with_id(7),
        ),
        if_enum_group(3, GradientStyle.CONIC)(
            SliderInput(
                "Rotation",
                minimum=0,
                maximum=360,
                default=0,
                unit="deg",
            ).with_id(8),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=expression.Image(
                width="Input0",
                height="Input1",
                channels="max(Input9.channels, Input10.channels)",
            )
        )
    ],
)
def create_gradient_node(
    width: int,
    height: int,
    color_1: Color,
    color_2: Color,
    reverse: bool,
    gradient_style: GradientStyle,
    diagonal_angle: int,
    diagonal_width: int,
    inner_radius_percent: int,
    outer_radius_percent: int,
    conic_rotation: int,
) -> np.ndarray:
    img = np.zeros((height, width), dtype=np.float32)

    if gradient_style == GradientStyle.HORIZONTAL:
        horizontal_gradient(img)

    elif gradient_style == GradientStyle.VERTICAL:
        vertical_gradient(img)

    elif gradient_style == GradientStyle.DIAGONAL:
        diagonal_gradient(img, diagonal_angle * np.pi / 180, diagonal_width)

    elif gradient_style == GradientStyle.RADIAL:
        radial_gradient(
            img,
            inner_radius_percent=inner_radius_percent / 100,
            outer_radius_percent=outer_radius_percent / 100,
        )

    elif gradient_style == GradientStyle.CONIC:
        conic_gradient(img, rotation=conic_rotation * np.pi / 180)

    if reverse:
        color_1, color_2 = color_2, color_1

    if color_1.channels > color_2.channels:
        color_2 = Color.from_1x1_image(
            as_target_channels(color_2.to_1x1_image(), color_1.channels)
        )
    elif color_2.channels > color_1.channels:
        color_1 = Color.from_1x1_image(
            as_target_channels(color_1.to_1x1_image(), color_2.channels)
        )

    c1 = color_1.to_image(width=width, height=height)
    c2 = color_2.to_image(width=width, height=height)
    if color_1.channels > 1:
        img = np.dstack((img,) * color_1.channels)

    return c2 * img + c1 * (1 - img)
