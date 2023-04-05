from __future__ import annotations

import cv2
import numpy as np

from nodes.properties.inputs import ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:high_pass",
    name="High Pass",
    description="Apply High Pass filter on image",
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        NumberInput("Radius", minimum=0, default=3, precision=2, controls_step=1),
        SliderInput(
            "Contrast",
            minimum=0,
            maximum=100,
            default=1,
            precision=2,
            controls_step=0.1,
            scale="log-offset",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def high_pass_filter_node(
    img: np.ndarray,
    radius: float,
    contrast: float,
) -> np.ndarray:
    alpha = None
    if img.shape[2] > 3:
        alpha = img[:, :, 3]
        img = img[:, :, :3]

    if radius == 0 or contrast == 0:
        img = img * 0 + 0.5
    else:
        img = contrast * (img - cv2.GaussianBlur(img, (0, 0), radius)) + 0.5

    if alpha is not None:
        img = np.dstack((img, alpha))

    return np.clip(img, 0, 1)
