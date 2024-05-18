from __future__ import annotations

import numpy as np
from chainner_ext import fast_gamma

from nodes.properties.inputs import BoolInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import gamma_group


@gamma_group.register(
    schema_id="chainner:image:gamma",
    name="Gamma",
    description="Adjusts the gamma of an image.",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "Gamma",
            min=0.01,
            max=100,
            default=1,
            precision=4,
            step=0.1,
            scale="log",
        ),
        BoolInput("Invert Gamma", default=False),
    ],
    outputs=[ImageOutput(shape_as=0, assume_normalized=True)],
)
def gamma_node(img: np.ndarray, gamma: float, invert_gamma: bool) -> np.ndarray:
    if gamma == 1:
        # noop
        return img

    if invert_gamma:
        gamma = 1 / gamma

    return fast_gamma(img, gamma)
