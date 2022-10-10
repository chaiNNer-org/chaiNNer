from __future__ import annotations

import numpy as np

from . import category as ImageAdjustmentCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c


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

    def run(self, img: np.ndarray, brightness: float, contrast: float) -> np.ndarray:
        """Adjusts the brightness and contrast of an image"""

        brightness /= 100
        contrast /= 100

        if brightness == 0 and contrast == 0:
            return img

        _, _, c = get_h_w_c(img)

        # Contrast correction factor
        max_c = 259 / 255
        factor: float = (max_c * (contrast + 1)) / (max_c - contrast)
        add: float = factor * brightness + 0.5 * (1 - factor)

        if c <= 3:
            img = factor * img + add
        else:
            img = np.concatenate(
                [
                    factor * img[:, :, :3] + add,
                    img[:, :, 3:],
                ],
                axis=2,
            )

        return np.clip(img, 0, 1)
