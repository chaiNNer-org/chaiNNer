from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:clamp",
    name="Clamp",
    description="将图像的值夹在一个范围内。",
    icon="ImContrast",
    inputs=[
        ImageInput(),
        SliderInput(
            "最小值",
            minimum=0.0,
            maximum=1.0,
            default=0.0,
            precision=4,
            controls_step=0.001,
            scale="log",
        ),
        SliderInput(
            "最大值",
            minimum=0.0,
            maximum=1.0,
            default=1.0,
            precision=4,
            controls_step=0.001,
            scale="log",
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="Input0",
        )
    ],
)
def clamp_node(img: np.ndarray, minimum: float, maximum: float) -> np.ndarray:
    return np.clip(img, minimum, maximum)
