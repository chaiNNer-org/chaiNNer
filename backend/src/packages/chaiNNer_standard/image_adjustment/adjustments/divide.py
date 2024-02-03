from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:divide",
    description="Divide all channels in an image by a value.",
    name="Divide",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "Divide",
            minimum=0.0,
            maximum=4.0,
            default=1.0,
            precision=4,
            controls_step=0.0001,
            scale="log",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def divide_node(img: np.ndarray, divide: float) -> np.ndarray:
    if divide == 1.0:
        return img

    img = img * (1.0 / divide)

    return img
