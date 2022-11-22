from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput


@NodeFactory.register("chainner:image:gaussian_blur")
class GaussianBlurNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply Gaussian blur to an image."
        self.inputs = [
            ImageInput(),
            NumberInput("Radius X", precision=1, controls_step=1),
            NumberInput("Radius Y", precision=1, controls_step=1),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Guassian Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur"

    def run(
        self,
        img: np.ndarray,
        sigma_x: float,
        sigma_y: float,
    ) -> np.ndarray:
        """Adjusts the blur of an image"""

        if sigma_x == 0 and sigma_y == 0:
            return img
        else:
            return np.clip(
                cv2.GaussianBlur(img, (0, 0), sigmaX=sigma_x, sigmaY=sigma_y), 0, 1
            )
