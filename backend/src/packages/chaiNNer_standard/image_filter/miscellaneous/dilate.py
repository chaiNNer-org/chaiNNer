from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


class MorphShape(Enum):
    RECTANGLE = cv2.MORPH_RECT
    ELLIPSE = cv2.MORPH_ELLIPSE
    CROSS = cv2.MORPH_CROSS


@miscellaneous_group.register(
    schema_id="chainner:image:dilate",
    name="Dilate",
    description="Dilate an image",
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput(),
        EnumInput(
            MorphShape,
            option_labels={
                MorphShape.RECTANGLE: "Square",
                MorphShape.ELLIPSE: "Circle",
                MorphShape.CROSS: "Cross",
            },
        ),
        SliderInput("Radius", min=0, max=1000, default=1, scale="log"),
        SliderInput("Iterations", min=0, max=1000, default=1, scale="log"),
    ],
    outputs=[ImageOutput(shape_as=0)],
)
def dilate_node(
    img: np.ndarray,
    morph_shape: MorphShape,
    radius: int,
    iterations: int,
) -> np.ndarray:
    if radius == 0 or iterations == 0:
        return img

    size = 2 * radius + 1
    element = cv2.getStructuringElement(morph_shape.value, (size, size))

    return cv2.dilate(img, element, iterations=iterations)
