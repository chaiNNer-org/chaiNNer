from __future__ import annotations

import numpy as np

from . import category as ImageFilterCategory
from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import (
    ImageInput,
    SliderInput,
    NoiseTypeDropdown,
    NoiseColorDropdown,
)
from ....api.outputs import ImageOutput
from ...utils.noise_utils import (
    gaussian_noise,
    uniform_noise,
    salt_and_pepper_noise,
    poisson_noise,
    speckle_noise,
    NoiseType,
)


@NodeFactory.register("chainner:image:add_noise")
class AddNoiseNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Add various kinds of noise to an image."
        self.inputs = [
            ImageInput(channels=[1, 3, 4]),
            NoiseTypeDropdown(),
            NoiseColorDropdown(),
            SliderInput("Amount", minimum=0, maximum=100, default=50),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""
                Image {
                    width: Input0.width,
                    height: Input0.height,
                    channels: max(
                        Input0.channels,
                        match Input2 { NoiseColor::Rgb => 3, NoiseColor::Gray => 1 }
                    )
                }"""
            )
        ]
        self.category = ImageFilterCategory
        self.name = "Add Noise"
        self.icon = "CgEditNoise"
        self.sub = "Noise"

    def run(
        self,
        img: np.ndarray,
        noise_type: str,
        noise_color: NoiseType,
        amount: int,
    ) -> np.ndarray:
        if noise_type == "gaussian":
            return gaussian_noise(img, amount / 100, noise_color)
        elif noise_type == "uniform":
            return uniform_noise(img, amount / 100, noise_color)
        elif noise_type == "salt_and_pepper":
            return salt_and_pepper_noise(img, amount / 100, noise_color)
        elif noise_type == "poisson":
            return poisson_noise(img, amount / 100, noise_color)
        elif noise_type == "speckle":
            return speckle_noise(img, amount / 100, noise_color)
        else:
            raise ValueError(f"Unknown noise type: {noise_type}")
