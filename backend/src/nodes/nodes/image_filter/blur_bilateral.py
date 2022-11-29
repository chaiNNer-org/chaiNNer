from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:bilateral_blur")
class BlurNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply surface/bilateral blur to an image."
        self.inputs = [
            ImageInput(),
            NumberInput("Radius", controls_step=1),
            NumberInput("Color Sigma", controls_step=1, default=75, maximum=100),
            NumberInput("Space Sigma", controls_step=1, default=75, maximum=100),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Surface Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur"

    def run(
        self,
        img: np.ndarray,
        radius: int,
        sigma_color: int,
        sigma_space: int,
    ) -> np.ndarray:

        if radius == 0:
            return img

        img = (img * 255.0).astype(np.uint8)

        _, _, c = get_h_w_c(img)
        if c == 4:
            rgb = img[:, :, :3]
            alpha = img[:, :, 3]
            rgb = cv2.bilateralFilter(
                rgb,
                radius,
                sigma_color,
                sigma_space,
                borderType=cv2.BORDER_REFLECT_101,
            )
            alpha = cv2.bilateralFilter(
                alpha,
                radius,
                sigma_color,
                sigma_space,
                borderType=cv2.BORDER_REFLECT_101,
            )
            result = np.dstack((rgb, alpha))

        else:
            result = cv2.bilateralFilter(
                img, radius, sigma_color, sigma_space, borderType=cv2.BORDER_REFLECT_101
            )
        return np.clip(result.astype(np.float32) / 255, 0, 1)
