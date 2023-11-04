from __future__ import annotations

from typing import TYPE_CHECKING

import cv2

import navi
from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group

if TYPE_CHECKING:
    import numpy as np


@miscellaneous_group.register(
    schema_id="chainner:image:canny_edge_detection",
    name="Canny Edge Detection",
    description=(
        "Detect the edges of the input image and output as black and white image."
    ),
    icon="MdAutoFixHigh",
    inputs=[
        ImageInput(),
        NumberInput("Lower Threshold", minimum=0, default=100),
        NumberInput("Upper Threshold", minimum=0, default=300),
    ],
    outputs=[ImageOutput(image_type=navi.Image(size_as="Input0"), channels=1)],
)
def canny_edge_detection_node(
    img: np.ndarray,
    t_lower: int,
    t_upper: int,
) -> np.ndarray:
    return cv2.Canny(to_uint8(img, normalized=True), t_lower, t_upper)
