from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:unpremultiply",
    description="Divide the RGB channels with the Alpha channel values of an image.",
    name="Unpremultiply",
    icon="CgMathDivide",
    inputs=[
        ImageInput(),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def unpremultiply_node(img: np.ndarray) -> np.ndarray:
    rgb = img[..., :3]
    alpha = img[..., 3]

    rgb_divided = rgb / alpha[..., np.newaxis]

    return np.concatenate((rgb_divided, alpha[..., np.newaxis]), axis=-1)
