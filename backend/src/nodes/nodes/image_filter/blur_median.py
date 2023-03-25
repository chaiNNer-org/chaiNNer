from __future__ import annotations

import cv2
import numpy as np

from ...impl.image_utils import normalize, to_uint8
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageFilterCategory


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
        self.sub = "Blur"

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
                blurred = cv2.medianBlur(to_uint8(img, normalized=True), 2 * radius + 1)

            return normalize(blurred)
