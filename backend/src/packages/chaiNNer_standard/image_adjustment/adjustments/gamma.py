from __future__ import annotations

import numpy as np
from chainner_ext import fast_gamma

from nodes.properties.inputs import BoolInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:gamma",
    name="Gamma",
    description="调整图像的伽马值。",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "伽马",
            minimum=0.01,
            maximum=100,
            default=1,
            precision=4,
            controls_step=0.1,
            scale="log",
        ),
        BoolInput("反转伽马", default=False),
    ],
    outputs=[
        ImageOutput(
            image_type="Input0",
            assume_normalized=True,
        )
    ],
)
def gamma_node(img: np.ndarray, gamma: float, invert_gamma: bool) -> np.ndarray:
    if gamma == 1:
        # noop
        return img

    if invert_gamma:
        gamma = 1 / gamma

    return fast_gamma(img, gamma)
