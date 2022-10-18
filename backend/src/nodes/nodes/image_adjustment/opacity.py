from __future__ import annotations

import numpy as np

from . import category as ImageAdjustmentCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.utils import get_h_w_c
from ...utils.pil_utils import convert_to_BGRA


@NodeFactory.register("chainner:image:opacity")
class OpacityNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Adjusts the opacity of an image. The higher the opacity value, the more opaque the image is."
        self.inputs = [
            ImageInput(),
            SliderInput(
                "Opacity",
                maximum=100,
                default=100,
                precision=1,
                controls_step=1,
                unit="%",
            ),
        ]
        self.outputs = [
            ImageOutput(image_type=expression.Image(size_as="Input0"), channels=4)
        ]
        self.category = ImageAdjustmentCategory
        self.name = "Opacity"
        self.icon = "MdOutlineOpacity"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray, opacity: float) -> np.ndarray:
        """Apply opacity adjustment to alpha channel"""

        # Convert inputs
        c = get_h_w_c(img)[2]
        if opacity == 100 and c == 4:
            return img
        imgout = convert_to_BGRA(img, c)
        opacity /= 100

        imgout[:, :, 3] *= opacity

        return imgout
