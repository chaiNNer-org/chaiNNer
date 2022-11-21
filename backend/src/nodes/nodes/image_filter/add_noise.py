from __future__ import annotations
from typing import Literal

from math import ceil

import cv2
import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    ImageInput,
    SliderInput,
    NoiseTypeDropdown,
    NoiseColorDropdown,
)
from ...properties.outputs import ImageOutput
from ...utils.noise_utils import (
    gaussian_noise,
    uniform_noise,
    salt_and_pepper_noise,
    poisson_noise,
    speckle_noise,
)


@NodeFactory.register("chainner:image:add_noise")
class AddNoiseNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Add various kinds of noise to an image."
        self.inputs = [
            ImageInput(),
            NoiseTypeDropdown(),
            NoiseColorDropdown(),
            SliderInput("Amount", minimum=0, maximum=100, default=50),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Add Noise"
        self.icon = "MdBlurOn"  # TODO: this
        self.sub = "Noise"

    def run(
        self,
        img: np.ndarray,
        noise_type: str,
        noise_color: Literal["gray", "rgb"],
        amount: int,
    ) -> np.ndarray:
        if noise_type == "gaussian":
            result = gaussian_noise(img, amount / 100, noise_color)
        elif noise_type == "uniform":
            result = uniform_noise(img, amount / 100, noise_color)
        elif noise_type == "salt_and_pepper":
            result = salt_and_pepper_noise(img, amount / 100, noise_color)
        elif noise_type == "poisson":
            result = poisson_noise(img, amount / 100, noise_color)
        elif noise_type == "speckle":
            result = speckle_noise(img, amount / 100, noise_color)
        else:
            raise ValueError(f"Unknown noise type: {noise_type}")

        return np.clip(result, 0, 1)
