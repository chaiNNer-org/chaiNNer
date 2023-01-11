from __future__ import annotations
import numpy as np
import cv2

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:lut")
class LutNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Apply a look up table (LUT) to a grayscale image."
            " Only the top row of pixels (y=0) of the LUT will be used to do the look up."
        )
        self.inputs = [
            ImageInput(channels=1),
            ImageInput("LUT"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(size_as="Input0", channels_as="Input1")
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Apply LUT"
        self.icon = "MdGradient"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        lut: np.ndarray,
    ) -> np.ndarray:
        # only use top row
        lut = lut[0:1]

        _, w, _ = get_h_w_c(lut)
        if w != 256:
            # this intentionally uses OpenCV for resizing because it resizes all channels independently of each other.
            lut = cv2.resize(lut, (256, 1), interpolation=cv2.INTER_LINEAR)

        # convert to 8bit
        img = np.round(img * 255).astype(np.uint8)

        return lut[0, img]
