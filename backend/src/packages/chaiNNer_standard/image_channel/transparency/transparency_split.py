from __future__ import annotations

from typing import Tuple

import numpy as np

from nodes.impl.image_utils import as_target_channels
from nodes.properties import expression
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput

from . import node_group


@node_group.register(
    schema_id="chainner:image:split_transparency",
    name="Split Transparency",
    description=("Split image channels into RGB and Alpha (transparency) channels."),
    icon="MdCallSplit",
    inputs=[ImageInput(channels=[1, 3, 4])],
    outputs=[
        ImageOutput(
            "RGB Channels",
            image_type=expression.Image(size_as="Input0"),
            channels=3,
        ),
        ImageOutput(
            "Alpha Channel",
            image_type=expression.Image(size_as="Input0"),
            channels=1,
        ),
    ],
)
def split_transparency(img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Split a multi-channel image into separate channels"""

    img = as_target_channels(img, 4)

    rgb = img[:, :, :3]
    alpha = img[:, :, 3]

    return rgb, alpha
