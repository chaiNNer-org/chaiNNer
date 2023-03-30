from __future__ import annotations

import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import sharpen_group


@sharpen_group.register(
    schema_id="chainner:image:sharpen",
    name="Unsharp Mask",
    description="Apply sharpening to an image using an unsharp mask.",
    icon="MdBlurOff",
    inputs=[
        ImageInput(),
        NumberInput("Radius", minimum=0, default=3, precision=1, controls_step=1),
        SliderInput(
            "Amount",
            minimum=0,
            maximum=100,
            default=1,
            precision=1,
            controls_step=1,
            scale="log",
        ),
        SliderInput(
            "Threshold",
            minimum=0,
            maximum=100,
            default=0,
            precision=1,
            controls_step=1,
            scale="log",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def sharpen_node(
    img: np.ndarray,
    radius: float,
    amount: float,
    threshold: float,
) -> np.ndarray:
    if radius == 0 or amount == 0:
        return img

    blurred = cv2.GaussianBlur(img, (0, 0), radius)

    threshold /= 100
    if threshold == 0:
        img = cv2.addWeighted(img, amount + 1, blurred, -amount, 0)
    else:
        diff = img - blurred
        diff = np.sign(diff) * np.maximum(0, np.abs(diff) - threshold)
        img += diff * amount

    return np.clip(img, 0, 1)
