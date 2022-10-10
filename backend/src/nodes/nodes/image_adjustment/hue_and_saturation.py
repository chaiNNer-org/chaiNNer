from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageAdjustmentCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:hue_and_saturation")
class HueAndSaturationNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Adjust the hue and saturation of an image. This is performed in the HSV color-space."
        self.inputs = [
            ImageInput(channels=[1, 3, 4]),
            SliderInput(
                "Hue",
                minimum=-180,
                maximum=180,
                default=0,
                precision=1,
                controls_step=1,
            ),
            SliderInput(
                "Saturation",
                minimum=-100,
                maximum=100,
                default=0,
                precision=1,
                controls_step=1,
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Hue & Saturation"
        self.icon = "MdOutlineColorLens"
        self.sub = "Adjustments"

    def add_and_wrap_hue(self, img: np.ndarray, add_val: float) -> np.ndarray:
        """Adds hue change value to image and wraps on range overflow"""

        img += add_val
        img[img >= 360] -= 360  # Wrap positive overflow
        img[img < 0] += 360  # Wrap negative overflow
        return img

    def run(self, img: np.ndarray, hue: float, saturation: float) -> np.ndarray:
        """Adjust the hue and saturation of an image"""

        _, _, c = get_h_w_c(img)

        # Pass through grayscale and unadjusted images
        if c == 1 or (hue == 0 and saturation == 0):
            return img

        # Preserve alpha channel if it exists
        alpha = None
        if c > 3:
            alpha = img[:, :, 3]

        hls = cv2.cvtColor(img, cv2.COLOR_BGR2HLS)
        h, l, s = cv2.split(hls)

        # Adjust hue and saturation
        hnew = self.add_and_wrap_hue(h, hue)
        smod = 1 + (saturation / 100)
        snew = np.clip((s * smod), 0, 1)

        hlsnew = cv2.merge([hnew, l, snew])
        img = cv2.cvtColor(hlsnew, cv2.COLOR_HLS2BGR)
        if alpha is not None:  # Re-add alpha, if it exists
            img = np.dstack((img, alpha))

        return img
