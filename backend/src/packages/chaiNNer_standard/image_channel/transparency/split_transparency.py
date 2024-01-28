from __future__ import annotations

import numpy as np

import navi
from nodes.impl.image_utils import as_target_channels
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from . import node_group


@node_group.register(
    schema_id="chainner:image:split_transparency",
    name="Split Transparency",
    description="Split image channels into RGB and Alpha (transparency) channels.",
    icon="MdCallSplit",
    inputs=[ImageInput(channels=[1, 3, 4])],
    outputs=[
        ImageOutput(
            "RGB",
            image_type=navi.Image(size_as="Input0"),
            channels=3,
            assume_normalized=True,
        ),
        ImageOutput(
            "Alpha",
            image_type=navi.Image(size_as="Input0"),
            channels=1,
            assume_normalized=True,
        ),
    ],
)
def split_transparency_node(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    c = get_h_w_c(img)[2]
    if c == 3:
        # Performance optimization:
        # Subsequent operations will be faster since the underlying array will
        # be contiguous in memory. The speed up can anything from nothing to
        # 5x faster depending on the operation.
        return img, np.ones(img.shape[:2], dtype=img.dtype)

    img = as_target_channels(img, 4)

    rgb = img[:, :, :3]
    alpha = img[:, :, 3]

    return rgb, alpha
