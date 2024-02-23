from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:multiply",
    name="乘法",
    description="将图像中的所有通道乘以一个值。",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "乘数",
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
def multiply_node(img: np.ndarray, mult: float) -> np.ndarray:
    if mult == 1.0:
        return img

    img = img * mult

    return img
