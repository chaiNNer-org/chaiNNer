from __future__ import annotations

import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import blur_group


@blur_group.register(
    schema_id="chainner:image:gaussian_blur",
    name="Gaussian Blur",
    description="Apply Gaussian blur to an image.",
    icon="MdBlurOn",
    inputs=[
        ImageInput(),
        NumberInput("Radius X", precision=1, controls_step=1),
        NumberInput("Radius Y", precision=1, controls_step=1),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def gaussian_blur_node(
    img: np.ndarray,
    sigma_x: float,
    sigma_y: float,
) -> np.ndarray:
    if sigma_x == 0 and sigma_y == 0:
        return img
    else:
        return cv2.GaussianBlur(img, (0, 0), sigmaX=sigma_x, sigmaY=sigma_y)
