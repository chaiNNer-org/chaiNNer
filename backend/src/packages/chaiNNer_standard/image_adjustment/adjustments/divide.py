from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:divide",
    description="将图像中的所有通道除以一个值。",
    name="除法",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "除以",
            minimum=0.0001,
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
