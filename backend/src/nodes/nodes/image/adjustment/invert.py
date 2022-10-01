from __future__ import annotations

import numpy as np

from ....categories import ImageAdjustmentCategory
from ....node_base import NodeBase
from ....node_factory import NodeFactory
from ....properties.inputs import ImageInput
from ....properties.outputs import ImageOutput
from ....utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:invert")
class InvertNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Inverts all colors in an image."
        self.inputs = [ImageInput()]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Invert Color"
        self.icon = "MdInvertColors"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray) -> np.ndarray:
        c = get_h_w_c(img)[2]

        # invert the first 3 channels
        if c <= 3:
            return 1 - img

        img = img.copy()
        img[:, :, :3] = 1 - img[:, :, :3]
        return img
