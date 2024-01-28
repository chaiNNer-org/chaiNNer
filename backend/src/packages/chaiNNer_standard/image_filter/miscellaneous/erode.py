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
    schema_id="chainner:image:erode",
    name="Erode",
    description="Erode an image",
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
def erode_node(
    img: np.ndarray,
    morph_shape: MorphShape,
    radius: int,
    iterations: int,
) -> np.ndarray:
    if radius == 0 or iterations == 0:
        return img

    size = 2 * radius + 1
    element = cv2.getStructuringElement(morph_shape.value, (size, size))

    return cv2.erode(img, element, iterations=iterations)
