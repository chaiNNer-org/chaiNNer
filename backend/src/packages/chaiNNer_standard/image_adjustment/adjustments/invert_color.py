from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:invert",
    name="Invert Color",
    description="Inverts all colors in an image.",
    icon="MdInvertColors",
    inputs=[ImageInput()],
    outputs=[ImageOutput(shape_as=0, assume_normalized=True)],
)
def invert_color_node(img: np.ndarray) -> np.ndarray:
    c = get_h_w_c(img)[2]

    # invert the first 3 channels
    if c <= 3:
        return 1 - img

    img = img.copy()
    img[:, :, :3] = 1 - img[:, :, :3]
    return img
