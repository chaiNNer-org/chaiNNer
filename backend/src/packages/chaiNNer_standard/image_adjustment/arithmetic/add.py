from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import arithmetic_group


@arithmetic_group.register(
    schema_id="chainner:image:add",
    description="Add values to an image.",
    name="Add",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "Add",
            min=-100,
            max=100,
            default=0,
            precision=1,
            step=1,
        ),
    ],
    outputs=[ImageOutput(shape_as=0)],
)
def add_node(img: np.ndarray, add: float) -> np.ndarray:
    if add == 0:
        return img

    img = img + (add / 100)

    return img
