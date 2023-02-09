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
        ]
        self.outputs = [
            ImageOutput(
                width="Input0",
                height="Input1",
                channels=1,
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
    ) -> np.ndarray:
        img = np.zeros((height, width), dtype=np.float32)

        if gradient_style == GradientStyle.HORIZONTAL:
            horizontal_gradient(img)

        elif gradient_style == GradientStyle.VERTICAL:
            vertical_gradient(img)

        elif gradient_style == GradientStyle.DIAGONAL:
            diagonal_gradient(img)

        elif gradient_style == GradientStyle.RADIAL:
            radial_gradient(
                img,
                inner_radius_percent=inner_radius_percent / 100,
                outer_radius_percent=outer_radius_percent / 100,
            )

        elif gradient_style == GradientStyle.CONIC:
            conic_gradient(img, rotation=conic_rotation * np.pi / 180)

        return img
