from __future__ import annotations

from enum import Enum

import numpy as np

from . import category as ImageUtilityCategory
from ...impl.gradients import (
    horizontal_gradient,
    vertical_gradient,
    diagonal_gradient,
    radial_gradient,
    conic_gradient,
)
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import (
    NumberInput,
    EnumInput,
    SliderInput,
)
from ...properties.outputs import ImageOutput


class ColorMode(Enum):
    RGB = 3
    RGBA = 4
    GRAYSCALE = 1


class GradientStyle(Enum):
    HORIZONTAL = "Horizontal"
    VERTICAL = "Vertical"
    DIAGONAL = "Diagonal"
    RADIAL = "Radial"
    CONIC = "Conic"


@NodeFactory.register("chainner:image:create_gradient")
class CreateGradientNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Create an image with a gradient."
        self.inputs = [
            NumberInput("Width", minimum=1, unit="px", default=64),
            NumberInput("Height", minimum=1, unit="px", default=64),
            EnumInput(GradientStyle, default_value=GradientStyle.HORIZONTAL).with_id(2),
            group(
                "conditional-enum",
                {
                    "enum": 2,
                    "conditions": [
                        [GradientStyle.RADIAL.value],
                        [GradientStyle.RADIAL.value],
                        [GradientStyle.CONIC.value],
                    ],
                },
            )(
                SliderInput(
                    "Inner Radius",
                    minimum=0,
                    maximum=100,
                    default=0,
                    unit="%",
                ),
                SliderInput(
                    "Outer Radius",
                    minimum=0,
                    maximum=100,
                    default=100,
                    unit="%",
                ),
                SliderInput(
                    "Rotation",
                    minimum=0,
                    maximum=360,
                    default=0,
                    unit="deg",
                ),
            ),
            SliderInput(
                "Middle Color Position",
                minimum=0,
                maximum=100,
                default=50,
                unit="%",
            ),
            EnumInput(ColorMode, default_value=ColorMode.GRAYSCALE).with_id(7),
            group(
                "conditional-enum",
                {
                    "enum": 7,
                    "conditions": [
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGBA.value],
                        [ColorMode.GRAYSCALE.value],
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGBA.value],
                        [ColorMode.GRAYSCALE.value],
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGB.value, ColorMode.RGBA.value],
                        [ColorMode.RGBA.value],
                        [ColorMode.GRAYSCALE.value],
                    ],
                },
            )(
                SliderInput(
                    "Red 1",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ff0000"],
                ),
                SliderInput(
                    "Green 1",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#00ff00"],
                ),
                SliderInput(
                    "Blue 1",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#0000ff"],
                ),
                SliderInput(
                    "Alpha 1",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ffffff"],
                ),
                SliderInput(
                    "Gray 1",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ffffff"],
                ),
                SliderInput(
                    "Red 2",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ff0000"],
                ),
                SliderInput(
                    "Green 2",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#00ff00"],
                ),
                SliderInput(
                    "Blue 2",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#0000ff"],
                ),
                SliderInput(
                    "Alpha 2",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ffffff"],
                ),
                SliderInput(
                    "Gray 2",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ffffff"],
                ),
                SliderInput(
                    "Red 3",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ff0000"],
                ),
                SliderInput(
                    "Green 3",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#00ff00"],
                ),
                SliderInput(
                    "Blue 3",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#0000ff"],
                ),
                SliderInput(
                    "Alpha 3",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ffffff"],
                ),
                SliderInput(
                    "Gray 3",
                    minimum=0,
                    maximum=255,
                    default=0,
                    gradient=["#000000", "#ffffff"],
                ),
            ),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                Image {
                    width: Input0,
                    height: Input1,
                    channels: match Input7 {
                        ColorMode::Grayscale => 1,
                        ColorMode::Rgb => 3,
                        ColorMode::Rgba => 4,
                    }
                }
                """
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Create Gradient"
        self.icon = "MdFormatColorFill"
        self.sub = "Create Images"

    def run(
        self,
        width: int,
        height: int,
        gradient_style: GradientStyle,
        inner_radius_percent: float,
        outer_radius_percent: float,
        conic_rotation: float,
        middle_position: float,
        color_mode: ColorMode,
        red1: int,
        green1: int,
        blue1: int,
        alpha1: int,
        gray1: int,
        red2: int,
        green2: int,
        blue2: int,
        alpha2: int,
        gray2: int,
        red3: int,
        green3: int,
        blue3: int,
        alpha3: int,
        gray3: int,
    ) -> np.ndarray:
        middle_position = middle_position / 100

        img, color1, color2, color3 = None, None, None, None
        if color_mode == ColorMode.RGB:
            img = np.zeros((height, width, 3), dtype=np.float32)
            color1 = np.array([blue1, green1, red1], dtype="float32") / 255
            color2 = np.array([blue2, green2, red2], dtype="float32") / 255
            color3 = np.array([blue3, green3, red3], dtype="float32") / 255
        elif color_mode == ColorMode.RGBA:
            img = np.zeros((height, width, 4), dtype=np.float32)
            color1 = np.array([blue1, green1, red1, alpha1], dtype="float32") / 255
            color2 = np.array([blue2, green2, red2, alpha2], dtype="float32") / 255
            color3 = np.array([blue3, green3, red3, alpha3], dtype="float32") / 255
        elif color_mode == ColorMode.GRAYSCALE:
            img = np.zeros((height, width, 1), dtype=np.float32)
            color1 = np.array([gray1], dtype="float32") / 255
            color2 = np.array([gray2], dtype="float32") / 255
            color3 = np.array([gray3], dtype="float32") / 255

        if gradient_style == GradientStyle.HORIZONTAL:
            horizontal_gradient(img, color1, color2, color3, middle_position)

        elif gradient_style == GradientStyle.VERTICAL:
            vertical_gradient(img, color1, color2, color3, middle_position)

        elif gradient_style == GradientStyle.DIAGONAL:
            diagonal_gradient(img, color1, color2, color3, middle_position)

        elif gradient_style == GradientStyle.RADIAL:
            radial_gradient(
                img,
                color1,
                color2,
                color3,
                middle_position,
                inner_radius_percent=inner_radius_percent / 100,
                outer_radius_percent=outer_radius_percent / 100,
            )

        elif gradient_style == GradientStyle.CONIC:
            conic_gradient(
                img,
                color1,
                color2,
                color3,
                middle_position,
                rotation=conic_rotation * np.pi / 180,
            )

        return img
