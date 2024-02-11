from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import compositing_group


@compositing_group.register(
    schema_id="chainner:image:mix",
    name="Mix",
    description="Mixes 2 images together.",
    icon="BsLayersHalf",
    inputs=[
        ImageInput("Image A"),
        ImageInput("Image B"),
        SliderInput(
            "Mix",
            minimum=0.0,
            maximum=1.0,
            default=0.5,
            precision=4,
            controls_step=0.001,
            scale="linear",
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="Input0",
        )
    ],
)
def mix_node(input1: np.ndarray, input2: np.ndarray, mix: float) -> np.ndarray:
    mixed_image = (1 - mix) * input1 + mix * input2
    return mixed_image
