from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:add",
    description="给图像添加数值。",
    name="添加",
    icon="ImBrightnessContrast",
    inputs=[
        ImageInput("图像输入"),
        SliderInput(
            "添加值",
            minimum=-100,
            maximum=100,
            default=0,
            precision=1,
            controls_step=1,
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def add_node(img: np.ndarray, add: float) -> np.ndarray:
    if add == 0:
        return img

    img = img + (add / 100)

    return img
