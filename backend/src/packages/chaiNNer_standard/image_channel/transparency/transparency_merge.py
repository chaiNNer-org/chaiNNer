from __future__ import annotations

import cv2
import numpy as np
from sanic.log import logger

from nodes.properties import expression
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput

from . import node_group


@node_group.register(
    schema_id="chainner:image:merge_transparency",
    name="Merge Transparency",
    description="Merge RGB and Alpha (transparency) image channels into 4-channel RGBA channels.",
    icon="MdCallMerge",
    inputs=[
        ImageInput("RGB Channels"),
        ImageInput("Alpha Channel", channels=1),
    ],
    outputs=[
        ImageOutput(
            image_type=expression.Image(
                width="Input0.width & Input1.width",
                height="Input0.height & Input1.height",
            ),
            channels=4,
        ).with_never_reason(
            "The RGB and alpha channels have different sizes but must have the same size."
        )
    ],
)
def merge_transparency_node(rgb: np.ndarray, a: np.ndarray) -> np.ndarray:
    """Combine separate channels into a multi-chanel image"""

    start_shape = rgb.shape[:2]
    logger.debug(start_shape)

    for im in rgb, a:
        logger.debug(im.shape[:2])
        assert (
            im.shape[:2] == start_shape
        ), "All images to be merged must be the same resolution"

    if rgb.ndim == 2:
        rgb = cv2.merge((rgb, rgb, rgb))
    elif rgb.ndim > 2 and rgb.shape[2] == 2:
        rgb = cv2.merge(
            (rgb, np.zeros((rgb.shape[0], rgb.shape[1], 1), dtype=rgb.dtype))
        )
    elif rgb.shape[2] > 3:
        rgb = rgb[:, :, :3]

    if a.ndim > 2:
        a = a[:, :, 0]
    a = np.expand_dims(a, axis=2)

    imgs = [rgb, a]
    for img in imgs:
        logger.debug(img.shape)
    img = np.concatenate(imgs, axis=2)

    return img
