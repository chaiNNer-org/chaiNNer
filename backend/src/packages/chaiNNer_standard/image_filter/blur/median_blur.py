from __future__ import annotations

import cv2
import numpy as np

from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import blur_group


@blur_group.register(
    schema_id="chainner:image:median_blur",
    name="Median Blur",
    description="Apply median blur to an image.",
    icon="MdBlurOn",
    inputs=[
        ImageInput(),
        SliderInput("Radius", minimum=0, maximum=1000, default=1, scale="log"),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def median_blur_node(
    img: np.ndarray,
    radius: int,
) -> np.ndarray:
    if radius == 0:
        return img
    else:
        size = 2 * radius + 1
        if size <= 5:
            return cv2.medianBlur(img, size)
        else:  # cv2 requires uint8 for kernel size > 5
            return cv2.medianBlur(to_uint8(img, normalized=True), size)
