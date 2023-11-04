from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

import cv2

from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group

if TYPE_CHECKING:
    import numpy as np


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
        SliderInput(
            "Radius",
            minimum=0,
            maximum=1000,
            default=1,
            controls_step=1,
            scale="log",
        ),
        SliderInput(
            "Iterations",
            minimum=0,
            maximum=1000,
            default=1,
            controls_step=1,
            scale="log",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def dilate_node(
    img: np.ndarray,
    morph_shape: MorphShape,
    radius: int,
    iterations: int,
) -> np.ndarray:
    """Dilate an image"""

    if radius == 0 or iterations == 0:
        return img

    size = 2 * radius + 1
    element = cv2.getStructuringElement(morph_shape.value, (size, size))

    return cv2.dilate(img, element, iterations=iterations)
