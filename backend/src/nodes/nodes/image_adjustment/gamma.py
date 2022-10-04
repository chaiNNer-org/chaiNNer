from __future__ import annotations

import numpy as np

from . import category as ImageAdjustmentCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, GammaOptionInput
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:gamma")
class GammaNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Adjusts the gamma of an image."
        self.inputs = [
            ImageInput(),
            NumberInput(
                "Gamma",
                minimum=0.01,
                maximum=100,
                default=1,
                precision=4,
                controls_step=0.1,
            ),
            GammaOptionInput(),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Gamma"
        self.icon = "ImBrightnessContrast"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray, gamma: float, gamma_option: str) -> np.ndarray:
        if gamma == 1:
            # noop
            return img

        if gamma_option == "normal":
            pass
        elif gamma_option == "invert":
            gamma = 1 / gamma
        else:
            assert False, f"Invalid gamma option: {gamma_option}"

        # single-channel grayscale
        if img.ndim == 2:
            return img**gamma

        img = img.copy()
        # apply gamma to the first 3 channels
        c = get_h_w_c(img)[2]
        img[:, :, : min(c, 3)] **= gamma
        return img
