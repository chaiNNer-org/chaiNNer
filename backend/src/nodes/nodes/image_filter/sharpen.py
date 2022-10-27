from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput


@NodeFactory.register("chainner:image:sharpen")
class SharpenNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply sharpening to an image using an unsharp mask."
        self.inputs = [
            ImageInput(),
            NumberInput("Amount", default=1, minimum=1),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Sharpen"
        self.icon = "MdBlurOff"
        self.sub = "Blur/Sharpen"

    def run(
        self,
        img: np.ndarray,
        amount: float,
    ) -> np.ndarray:
        """Adjusts the sharpening of an image"""

        blurred = cv2.GaussianBlur(img, (0, 0), amount)
        img = cv2.addWeighted(img, 2.0, blurred, -1.0, 0)

        return np.clip(img, 0, 1)
