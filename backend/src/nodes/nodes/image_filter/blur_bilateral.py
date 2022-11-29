from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, SliderInput
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:bilateral_blur")
class BlurNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply surface/bilateral blur to an image."
        self.inputs = [
            ImageInput(),
            NumberInput("Diameter", controls_step=1, default=12),
            SliderInput(
                "Color Sigma",
                controls_step=1,
                default=25,
                scale="log",
                minimum=0,
                maximum=1000,
            ),
            SliderInput(
                "Space Sigma",
                controls_step=1,
                default=25,
                scale="log",
                minimum=0,
                maximum=1000,
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Surface Blur"
        self.icon = "MdBlurOn"
        self.sub = "Blur"

    def run(
        self,
        img: np.ndarray,
        diameter: int,
        sigma_color: int,
        sigma_space: int,
    ) -> np.ndarray:

        if diameter == 0 or sigma_space == 0:
            return img

        sigma_color_adjusted = sigma_color / 255

        _, _, c = get_h_w_c(img)
        if c == 4:
            rgb = img[:, :, :3]
            alpha = img[:, :, 3]
            rgb = cv2.bilateralFilter(
                rgb,
                diameter,
                sigma_color_adjusted,
                sigma_space,
                borderType=cv2.BORDER_REFLECT_101,
            )
            alpha = cv2.bilateralFilter(
                alpha,
                diameter,
                sigma_color_adjusted,
                sigma_space,
                borderType=cv2.BORDER_REFLECT_101,
            )
            return np.dstack((rgb, alpha))

        return cv2.bilateralFilter(
            img,
            diameter,
            sigma_color_adjusted,
            sigma_space,
            borderType=cv2.BORDER_REFLECT_101,
        )
