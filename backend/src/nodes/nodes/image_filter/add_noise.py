from __future__ import annotations
from typing import Literal

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
from ...utils.image_utils import get_h_w_c


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
        image: np.ndarray,
        noise_type: str,
        noise_color: Literal["gray", "rgb"],
        amount: int,
    ) -> np.ndarray:
        img = image
        _, _, c = get_h_w_c(img)
        if c == 4:
            img = img[:, :, :3]
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
        if c == 4:
            result = np.concatenate([result, image[:, :, 3:]], axis=2)

        return np.clip(result, 0, 1)
