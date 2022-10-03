from __future__ import annotations
from typing import Tuple

import numpy as np
from sanic.log import logger

from . import category as ImageChannelCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...properties import expression


@NodeFactory.register("chainner:image:split_transparency")
class TransparencySplitNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Split image channels into RGB and Alpha (transparency) channels."
        )
        self.inputs = [ImageInput(image_type=expression.Image(channels=[1, 3, 4]))]
        self.outputs = [
            ImageOutput("RGB Channels", expression.Image(size_as="Input0", channels=3)),
            ImageOutput(
                "Alpha Channel", expression.Image(size_as="Input0", channels=1)
            ),
        ]
        self.category = ImageChannelCategory
        self.name = "Split Transparency"
        self.icon = "MdCallSplit"
        self.sub = "Transparency"

    def run(self, img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Split a multi-channel image into separate channels"""

        if img.ndim == 2:
            logger.debug("Expanding image channels")
            img = np.tile(np.expand_dims(img, axis=2), (1, 1, min(4, 3)))
        # Pad with solid alpha channel if needed (i.e three channel image)
        elif img.shape[2] == 3:
            logger.debug("Expanding image channels")
            img = np.dstack((img, np.full(img.shape[:-1], 1.0)))

        rgb = img[:, :, :3]
        alpha = img[:, :, 3]

        return rgb, alpha
