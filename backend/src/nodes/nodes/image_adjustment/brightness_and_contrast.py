from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageAdjustmentCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput
from ...properties.outputs import ImageOutput


@NodeFactory.register("chainner:image:brightness_and_contrast")
class BrightnessAndContrastNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Adjust the brightness and contrast of an image."
        self.inputs = [
            ImageInput(),
            SliderInput(
                "Brightness",
                minimum=-100,
                maximum=100,
                default=0,
                precision=1,
                controls_step=1,
            ),
            SliderInput(
                "Contrast",
                minimum=-100,
                maximum=100,
                default=0,
                precision=1,
                controls_step=1,
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Brightness & Contrast"
        self.icon = "ImBrightnessContrast"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray, b_amount: float, c_amount: float) -> np.ndarray:
        """Adjusts the brightness and contrast of an image"""

        b_norm_amount = b_amount / 100
        c_norm_amount = c_amount / 100

        # Pass through unadjusted image
        if b_norm_amount == 0 and c_norm_amount == 0:
            return img

        # Calculate brightness adjustment
        if b_norm_amount > 0:
            shadow = b_norm_amount
            highlight = 1
        else:
            shadow = 0
            highlight = 1 + b_norm_amount
        alpha_b = highlight - shadow
        if img.ndim == 2:
            img = cv2.addWeighted(img, alpha_b, img, 0, shadow)
        else:
            img[:, :, :3] = cv2.addWeighted(
                img[:, :, :3], alpha_b, img[:, :, :3], 0, shadow
            )

        # Calculate contrast adjustment
        alpha_c = ((259 / 255) * (c_norm_amount + 1)) / (
            (259 / 255) - c_norm_amount
        )  # Contrast correction factor
        gamma_c = 0.5 * (1 - alpha_c)
        if img.ndim == 2:
            img = cv2.addWeighted(img, alpha_c, img, 0, gamma_c)
        else:
            img[:, :, :3] = cv2.addWeighted(
                img[:, :, :3], alpha_c, img[:, :, :3], 0, gamma_c
            )
        img = np.clip(img, 0, 1).astype("float32")

        return img
