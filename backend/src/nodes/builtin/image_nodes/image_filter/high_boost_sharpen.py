from __future__ import annotations

import cv2
import numpy as np

from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import HbfTypeDropdown, ImageInput, SliderInput
from ....api.outputs import ImageOutput
from ...utils.image_utils import KernelType
from . import category as ImageFilterCategory


@NodeFactory.register("chainner:image:sharpen_hbf")
class HbfSharpenNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply sharpening to an image using a high boost filter."
        self.inputs = [
            ImageInput(),
            HbfTypeDropdown(),
            SliderInput(
                "Amount",
                minimum=0,
                maximum=100,
                default=2,
                precision=1,
                controls_step=1,
                scale="log",
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "High Boost Filter"
        self.icon = "MdBlurOff"
        self.sub = "Sharpen"

    def run(
        self,
        img: np.ndarray,
        kernel_type: int,
        amount: float,
    ) -> np.ndarray:
        if amount == 0:
            return img

        identity = np.array([[0, 0, 0], [0, 1, 0], [0, 0, 0]])
        if kernel_type == KernelType.STRONG:
            # 8-neighbor kernel
            kernel = identity - np.array([[1, 1, 1], [1, 1, 1], [1, 1, 1]]) / 9
        else:
            # 4-neighbor kernel
            kernel = identity - np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]) / 5

        kernel = kernel * amount + identity
        filtered_img = cv2.filter2D(img, -1, kernel)

        return np.clip(filtered_img, 0, 1)
