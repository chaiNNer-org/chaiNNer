from __future__ import annotations
from typing import Tuple

import numpy as np

from . import category as ImageChannelCategory
from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import ImageInput
from ....api.outputs import ImageOutput
from ....api import expression
from ...utils.image_utils import as_target_channels


@NodeFactory.register("chainner:image:split_transparency")
class TransparencySplitNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Split image channels into RGB and Alpha (transparency) channels."
        )
        self.inputs = [ImageInput(channels=[1, 3, 4])]
        self.outputs = [
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
        ]
        self.category = ImageChannelCategory
        self.name = "Split Transparency"
        self.icon = "MdCallSplit"
        self.sub = "Transparency"

    def run(self, img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Split a multi-channel image into separate channels"""

        img = as_target_channels(img, 4)

        rgb = img[:, :, :3]
        alpha = img[:, :, 3]

        return rgb, alpha
