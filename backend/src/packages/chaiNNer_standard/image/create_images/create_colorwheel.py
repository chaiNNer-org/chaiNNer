from __future__ import annotations

import cv2
import numpy as np

import navi
from nodes.impl.gradients import (
    conic_gradient,
)
from nodes.properties.inputs import (
    NumberInput,
)
from nodes.properties.outputs import ImageOutput

from .. import create_images_group


@create_images_group.register(
    schema_id="chainner:image:create_colorwheel",
    name="Create Colorwheel",
    description="Create an image with a color wheel.",
    icon="MdLens",
    inputs=[
        NumberInput("Size", minimum=1, unit="px", default=512),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(  # Creates a square output buffer from scratch and sets it to the width and height defined by the (Number)Input0 defined earlier
                width="Input0",
                height="Input0",
            ),
            channels=3,
        )
    ],
)
def create_colorwheel_node(
    size: int,
) -> np.ndarray:
    img = np.zeros((size, size), dtype=np.float32)  # Create a new buffer with all zeros

    conic_gradient(
        img, rotation=0 * np.pi / 180
    )  # Create our hue component with a chaiNNer conic gradient

    w = np.ones(
        (size, size), dtype=np.float32
    )  # Create a new buffer with a value of "one"

    hsv = np.stack((img, w, w), axis=2)  # Stack our HSV channels to BGR order

    hsv[:, :, 0] *= 360  # Rotate the channel order

    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
