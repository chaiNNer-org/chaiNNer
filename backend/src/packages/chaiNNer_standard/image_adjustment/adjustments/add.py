from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:add",
    description="Add values to an image.",
    name="Add",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "Add",
            minimum=-100,
            maximum=100,
            default=0,
            precision=1,
            controls_step=1,
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def add_node(
    img: np.ndarray, add: float
) -> np.ndarray:

    if add == 0:
        return img

    img = img + add

    return img
