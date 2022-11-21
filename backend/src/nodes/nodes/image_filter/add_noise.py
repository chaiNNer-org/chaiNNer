from __future__ import annotations

from math import ceil

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput, NoiseTypeDropdown
from ...properties.outputs import ImageOutput


@NodeFactory.register("chainner:image:add_noise")
class AddNoiseNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Add various kinds of noise to an image."
        self.inputs = [
            ImageInput(),
            NoiseTypeDropdown(),
            SliderInput("Amount", minimum=0, maximum=100, default=50),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Add Noise"
        self.icon = "MdBlurOn"  # TODO: this
        self.sub = "Noise"

    def add_noise(self, img: np.ndarray, noise_type: str, amt: int) -> np.ndarray:
        if noise_type == "gauss":
            amount = 1 - (amt / 100)
            row, col, ch = img.shape
            mean = 0
            var = 0.1
            sigma = var**amount
            gauss = np.random.normal(mean, sigma, (row, col, ch))
            gauss = gauss.reshape(row, col, ch)
            noisy = img + gauss
            return noisy
        elif noise_type == "s&p":
            row, col, ch = img.shape
            s_vs_p = 0.5
            amount = 0.004
            out = np.copy(img)
            # Salt mode
            num_salt = np.ceil(amount * img.size * s_vs_p)
            coords = [np.random.randint(0, i - 1, int(num_salt)) for i in img.shape]
            out[coords] = 1

            # Pepper mode
            num_pepper = np.ceil(amount * img.size * (1.0 - s_vs_p))
            coords = [np.random.randint(0, i - 1, int(num_pepper)) for i in img.shape]
            out[coords] = 0
            return out
        elif noise_type == "poisson":
            vals = len(np.unique(img))
            vals = 2 ** np.ceil(np.log2(vals))
            noisy = np.random.poisson(img * vals) / float(vals)
            return noisy  # type: ignore
        elif noise_type == "speckle":
            row, col, ch = img.shape
            gauss = np.random.randn(row, col, ch)
            gauss = gauss.reshape(row, col, ch)
            noisy = img + img * gauss
            return noisy
        else:
            return img

    def run(
        self,
        img: np.ndarray,
        noise_type: str,
        amount: int,
    ) -> np.ndarray:
        result = self.add_noise(img, noise_type, amount)

        # Linear filter with reflected padding
        return np.clip(result, 0, 1)
