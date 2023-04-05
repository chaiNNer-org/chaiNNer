from __future__ import annotations

from math import ceil

import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import blur_group


@blur_group.register(
    schema_id="chainner:image:blur",
    name="Box Blur",
    description="Apply box/average blur to an image.",
    icon="MdBlurOn",
    inputs=[
        ImageInput(),
        NumberInput("Radius X", precision=1, controls_step=1),
        NumberInput("Radius Y", precision=1, controls_step=1),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def box_blur_node(
    img: np.ndarray,
    radius_x: float,
    radius_y: float,
) -> np.ndarray:
    if radius_x == 0 and radius_y == 0:
        return img

    # Create kernel of dims h * w, rounded up to the closest odd integer
    kernel = np.ones((ceil(radius_y) * 2 + 1, ceil(radius_x) * 2 + 1), np.float32) / (
        (2 * radius_y + 1) * (2 * radius_x + 1)
    )

    # Modify edges of kernel by fractional amount if kernel size (2r+1) is not odd integer
    x_d = radius_x % 1
    y_d = radius_y % 1
    if y_d != 0:
        kernel[0, :] *= y_d
        kernel[-1, :] *= y_d
    if x_d != 0:
        kernel[:, 0] *= x_d
        kernel[:, -1] *= x_d

    # Linear filter with reflected padding
    return np.clip(
        cv2.filter2D(img, -1, kernel, borderType=cv2.BORDER_REFLECT_101), 0, 1
    )
