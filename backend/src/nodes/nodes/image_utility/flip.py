from __future__ import annotations

import numpy as np
import cv2

from ....categories import ImageUtilityCategory
from ....node_base import NodeBase
from ....node_factory import NodeFactory
from ....properties.inputs import ImageInput, FlipAxisInput
from ....properties.outputs import ImageOutput
from ....utils.image_utils import FlipAxis


@NodeFactory.register("chainner:image:flip")
class FlipNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Flip an image."
        self.inputs = [
            ImageInput("Image"),
            FlipAxisInput(),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageUtilityCategory
        self.name = "Flip"
        self.icon = "MdFlip"
        self.sub = "Modification"

    def run(self, img: np.ndarray, axis: int) -> np.ndarray:
        if axis == FlipAxis.NONE:
            return img
        return cv2.flip(img, axis)
