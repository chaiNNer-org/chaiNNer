from __future__ import annotations

from math import ceil

import cv2
import numpy as np

from ...categories import ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput


@NodeFactory.register("chainner:image:blur")
class BlurNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply box/average blur to an image."
        self.inputs = [
            ImageInput(),
            NumberInput("Amount X", precision=1, controls_step=1),
            NumberInput("Amount Y", precision=1, controls_step=1),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Box Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur/Sharpen"

    def run(
        self,
        img: np.ndarray,
        amount_x: float,
        amount_y: float,
    ) -> np.ndarray:
        """Adjusts the blur of an image"""

        if amount_x == 0 and amount_y == 0:
            return img

        # Create kernel of dims h * w, rounded up to the closest odd integer
        kernel = np.ones(
            (ceil(amount_y) * 2 + 1, ceil(amount_x) * 2 + 1), np.float32
        ) / ((2 * amount_y + 1) * (2 * amount_x + 1))

        # Modify edges of kernel by fractional amount if kernel size (2r+1) is not odd integer
        x_d = amount_x % 1
        y_d = amount_y % 1
        if y_d != 0:
            kernel[0, :] *= y_d
            kernel[-1, :] *= y_d
        if x_d != 0:
            kernel[:, 0] *= x_d
            kernel[:, -1] *= x_d

        # Linear filter with reflected padding
        return np.clip(
            cv2.filter2D(img, -1, kernel, borderType=cv2.BORDER_REFLECT_101), 0, 1
        )
