from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput


@NodeFactory.register("chainner:image:median_blur")
class MedianBlurNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply median blur to an image."
        self.inputs = [
            ImageInput(),
            NumberInput("Radius"),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Median Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur/Sharpen"

    def run(
        self,
        img: np.ndarray,
        radius: int,
    ) -> np.ndarray:
        """Adjusts the blur of an image"""

        if radius == 0:
            return img
        else:
            if radius < 3:
                blurred = cv2.medianBlur(img, 2 * radius + 1)
            else:  # cv2 requires uint8 for kernel size (2r+1) > 5
                img = (img * 255).astype("uint8")
                blurred = cv2.medianBlur(img, 2 * radius + 1).astype("float32") / 255

            return np.clip(blurred, 0, 1)
