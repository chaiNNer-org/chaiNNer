from __future__ import annotations
from typing import Tuple

import numpy as np

from . import category as ImageChannelCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:split_channels")
class SeparateRgbaNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Split image channels into separate channels. "
            "Typically used for splitting off an alpha (transparency) layer."
        )
        self.inputs = [ImageInput()]
        self.outputs = [
            ImageOutput(
                "R Channel", image_type=expression.Image(size_as="Input0"), channels=1
            ).with_id(2),
            ImageOutput(
                "G Channel", image_type=expression.Image(size_as="Input0"), channels=1
            ).with_id(1),
            ImageOutput(
                "B Channel", image_type=expression.Image(size_as="Input0"), channels=1
            ).with_id(0),
            ImageOutput(
                "A Channel", image_type=expression.Image(size_as="Input0"), channels=1
            ),
        ]
        self.category = ImageChannelCategory
        self.name = "Separate RGBA"
        self.icon = "MdCallSplit"
        self.sub = "All"

    def run(
        self, img: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        h, w, c = get_h_w_c(img)
        safe_out = np.ones((h, w))

        if img.ndim == 2:
            return img, safe_out, safe_out, safe_out

        c = min(c, 4)

        out = []
        for i in range(c):
            out.append(img[:, :, i])
        for i in range(4 - c):
            out.append(safe_out)

        return out[2], out[1], out[0], out[3]
