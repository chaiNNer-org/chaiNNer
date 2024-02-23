from __future__ import annotations

from enum import Enum

import numpy as np

import navi
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
    name="创建渐变",
    description="创建一个带有渐变的图像。",
    icon="MdFormatColorFill",
    inputs=[
        NumberInput("宽度", minimum=1, unit="px", default=64),
        NumberInput("高度", minimum=1, unit="px", default=64),
        ColorInput("颜色 1", default=Color.gray(0)).with_id(9),
        ColorInput("颜色 2", default=Color.gray(1)).with_id(10),
        BoolInput("反转", default=False).with_id(2),
        EnumInput(GradientStyle, default=GradientStyle.HORIZONTAL).with_id(3),
        if_enum_group(3, GradientStyle.DIAGONAL)(
            SliderInput(
                "角度",
                minimum=0,
                maximum=360,
                default=45,
                unit="度",
            ).with_id(4),
            NumberInput(
                "宽度",
                minimum=0,
                default=100,
                unit="px",
            ).with_id(5),
        ),
        if_enum_group(3, GradientStyle.RADIAL)(
            SliderInput(
                "内半径",
                minimum=0,
                maximum=100,
                default=0,
                unit="%",
            ).with_id(6),
            SliderInput(
                "外半径",
                minimum=0,
                maximum=100,
                default=100,
                unit="%",
            ).with_id(7),
        ),
        if_enum_group(3, GradientStyle.CONIC)(
            SliderInput(
                "旋转",
                minimum=0,
                maximum=360,
                default=0,
                unit="度",
            ).with_id(8),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
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
