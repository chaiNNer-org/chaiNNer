from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:premultiply",
    description="Multiply the RGB channels with the Alpha channel values of an image.",
    name="Premultiply",
    icon="CgClose",
    inputs=[
        ImageInput(),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def premultiply_node(img: np.ndarray) -> np.ndarray:
    rgb = img[..., :3]
    alpha = img[..., 3]

    rgb_multed = rgb * alpha[..., np.newaxis]

    return np.concatenate((rgb_multed, alpha[..., np.newaxis]), axis=-1)
