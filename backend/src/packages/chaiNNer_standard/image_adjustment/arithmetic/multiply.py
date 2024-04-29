from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import arithmetic_group


@arithmetic_group.register(
    schema_id="chainner:image:multiply",
    description="Multiply all channels in an image by a value.",
    name="Multiply",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "Multiply",
            minimum=0.0,
            maximum=4.0,
            default=1.0,
            precision=4,
            controls_step=0.0001,
            scale="log",
        ),
    ],
    outputs=[ImageOutput(shape_as=0)],
)
def multiply_node(img: np.ndarray, mult: float) -> np.ndarray:
    if mult == 1.0:
        return img

    img = img * mult

    return img
