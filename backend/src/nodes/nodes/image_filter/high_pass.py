from __future__ import annotations

import cv2
import numpy as np

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageFilterCategory


@NodeFactory.register("chainner:image:high_pass")
class HighPassFilterNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply High Pass filter on image"
        self.inputs = [
            ImageInput(),
            NumberInput("Radius", minimum=0, default=1, precision=2, controls_step=1),
            NumberInput("Contrast", minimum=0, default=1, precision=2, controls_step=1),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "High Pass"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        radius: float,
        contrast: float,
    ) -> np.ndarray:
        """High Pass filter"""

        if radius == 0 or contrast == 0:
            return img * 0 + 0.5
        else:
            return np.clip(
                contrast * (img - cv2.GaussianBlur(img, (0, 0), radius)) + 0.5,
                0,
                1,
            )
