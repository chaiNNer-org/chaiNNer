from __future__ import annotations

import numpy as np

from nodes.properties.inputs import BoolInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:gamma",
    name="Gamma",
    description="Adjusts the gamma of an image.",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        NumberInput(
            "Gamma",
            minimum=0.01,
            maximum=100,
            default=1,
            precision=4,
            controls_step=0.1,
        ),
        BoolInput("Invert Gamma", default=False),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def gamma_node(img: np.ndarray, gamma: float, invert_gamma: bool) -> np.ndarray:
    if gamma == 1:
        # noop
        return img

    if invert_gamma:
        gamma = 1 / gamma

    # single-channel grayscale
    if img.ndim == 2:
        return img**gamma

    img = img.copy()
    # apply gamma to the first 3 channels
    c = get_h_w_c(img)[2]
    img[:, :, : min(c, 3)] **= gamma
    return img
