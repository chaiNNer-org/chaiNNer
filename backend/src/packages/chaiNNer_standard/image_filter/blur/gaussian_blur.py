from __future__ import annotations

import numpy as np

from nodes.groups import linked_inputs_group
from nodes.impl.image_utils import fast_gaussian_blur
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import blur_group


@blur_group.register(
    schema_id="chainner:image:gaussian_blur",
    name="Gaussian Blur",
    description="Apply Gaussian blur to an image.",
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
    outputs=[ImageOutput(shape_as=0)],
)
def gaussian_blur_node(
    img: np.ndarray,
    sigma_x: float,
    sigma_y: float,
) -> np.ndarray:
    if sigma_x == 0 and sigma_y == 0:
        return img

    return fast_gaussian_blur(img, sigma_x, sigma_y)
