from __future__ import annotations

import math
from math import ceil

import cv2
import numpy as np

from nodes.groups import linked_inputs_group
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import blur_group


def get_kernel_1d(radius: float) -> np.ndarray:
    kernel = np.ones(ceil(radius) * 2 + 1, np.float32)

    d = radius % 1
    if d != 0:
        kernel[0] *= d
        kernel[-1] *= d

    # normalize
    kernel /= np.sum(kernel)

    return kernel


def get_kernel_2d(radius_x: float, radius_y: float) -> np.ndarray:
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

    return kernel


@blur_group.register(
    schema_id="chainner:image:blur",
    name="Box Blur",
    description="Apply box/average blur to an image.",
    icon="MdBlurOn",
    inputs=[
        ImageInput(),
        linked_inputs_group(
            SliderInput(
                "Radius X",
                minimum=0,
                maximum=1000,
                default=1,
                precision=1,
                controls_step=1,
                slider_step=0.1,
                scale="log",
            ),
            SliderInput(
                "Radius Y",
                minimum=0,
                maximum=1000,
                default=1,
                precision=1,
                controls_step=1,
                slider_step=0.1,
                scale="log",
            ),
        ),
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

    # you can't tell the difference between a float and an integer when the radius is large enough
    radius_x = round(radius_x) if radius_x > 200 else radius_x
    radius_y = round(radius_y) if radius_y > 200 else radius_y

    # both radii are integers
    use_optimized_int = int(radius_x) == radius_x and int(radius_y) == radius_y

    if use_optimized_int:
        # we can use an optimized box blur implementation
        radius_x = int(round(radius_x))
        radius_y = int(round(radius_y))
        return cv2.blur(
            img, (radius_x * 2 + 1, radius_y * 2 + 1), borderType=cv2.BORDER_REFLECT_101
        )

    # cv2.blur is so much faster than the other methods, that it's worth manually separating the kernel.
    # the idea here is that we blur with cv2.blur in x or y if we can
    threshold = 15
    if radius_x >= threshold and int(radius_x) == radius_x:
        img = cv2.blur(
            img, (int(radius_x) * 2 + 1, 1), borderType=cv2.BORDER_REFLECT_101
        )
        radius_x = 1
    if radius_y >= threshold and int(radius_y) == radius_y:
        img = cv2.blur(
            img, (1, int(radius_y) * 2 + 1), borderType=cv2.BORDER_REFLECT_101
        )
        radius_y = 1

    # Separable filter is faster for relatively small kernels, but after a certain size it becomes
    # slower than filter2D's DFT implementation. The exact cutoff depends on the hardware.
    avg_radius = math.sqrt(radius_x * radius_y)
    use_sep = avg_radius < 70

    if use_sep:
        return cv2.sepFilter2D(
            img,
            -1,
            get_kernel_1d(radius_x),
            get_kernel_1d(radius_y),
            borderType=cv2.BORDER_REFLECT_101,
        )
    else:
        return cv2.filter2D(
            img,
            -1,
            get_kernel_2d(radius_x, radius_y),
            borderType=cv2.BORDER_REFLECT_101,
        )
