from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:distance_to_alpha",
    name="Distance to Alpha",
    description="Converts a distance field to an alpha mask by adjusting the image contrast.",
    icon="MdBlurOn",
    inputs=[
        ImageInput(channels=1),
        NumberInput("Spread", min=1, default=4),
        SliderInput("Cutoff", min=0, default=0.5, max=1, precision=2),
        SliderInput("Edge Width", min=0.01, default=0.5, max=4, precision=2),
    ],
    outputs=[ImageOutput(shape_as=0, assume_normalized=True)],
)
def distance_to_alpha_node(
    img: np.ndarray,
    spread: int,
    cutoff: float,
    width: float,
) -> np.ndarray:
    # This is essentially a pivoted contrast node
    contrast = (spread * 2) / width
    pivot = 1 - cutoff
    return np.clip(pivot + (img - pivot) * contrast, 0, 1)
