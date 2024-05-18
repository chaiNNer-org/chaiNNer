from __future__ import annotations

import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import blur_group


@blur_group.register(
    schema_id="chainner:image:bilateral_blur",
    name="Surface Blur",
    description="Apply surface/bilateral blur to an image.",
    icon="MdBlurOn",
    inputs=[
        ImageInput(),
        SliderInput("Radius", min=0, max=100, default=4, scale="sqrt"),
        SliderInput("Color Sigma", default=25, scale="log", min=0, max=1000),
        SliderInput("Space Sigma", default=25, scale="log", min=0, max=1000),
    ],
    outputs=[ImageOutput(shape_as=0)],
)
def surface_blur_node(
    img: np.ndarray,
    radius: int,
    sigma_color: int,
    sigma_space: int,
) -> np.ndarray:
    if radius == 0 or sigma_color == 0 or sigma_space == 0:
        return img

    sigma_color_adjusted = sigma_color / 255
    diameter = radius * 2 + 1

    _, _, c = get_h_w_c(img)
    if c == 4:
        rgb = img[:, :, :3]
        alpha = img[:, :, 3]
        rgb = cv2.bilateralFilter(
            rgb,
            diameter,
            sigma_color_adjusted,
            sigma_space,
            borderType=cv2.BORDER_REFLECT_101,
        )
        alpha = cv2.bilateralFilter(
            alpha,
            diameter,
            sigma_color_adjusted,
            sigma_space,
            borderType=cv2.BORDER_REFLECT_101,
        )
        return np.dstack((rgb, alpha))

    return cv2.bilateralFilter(
        img,
        diameter,
        sigma_color_adjusted,
        sigma_space,
        borderType=cv2.BORDER_REFLECT_101,
    )
