from __future__ import annotations
from enum import Enum

import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput, EnumInput, NumberInput
from ...properties.outputs import ImageOutput
from ...impl.noise import (
    gaussian_noise,
    uniform_noise,
    salt_and_pepper_noise,
    poisson_noise,
    speckle_noise,
    NoiseColor,
)


class NoiseType(Enum):
    GAUSSIAN = "gaussian"
    UNIFORM = "uniform"
    SALT_AND_PEPPER = "salt_and_pepper"
    SPECKLE = "speckle"
    POISSON = "poisson"


@NodeFactory.register("chainner:image:add_noise")
class AddNoiseNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Add various kinds of noise to an image."
        self.inputs = [
            ImageInput(channels=[1, 3, 4]),
            EnumInput(
                NoiseType, option_labels={NoiseType.SALT_AND_PEPPER: "Salt & Pepper"}
            ),
            EnumInput(
                NoiseColor,
                option_labels={
                    NoiseColor.RGB: "Color",
                    NoiseColor.GRAY: "Monochrome",
                },
            ),
            SliderInput("Amount", minimum=0, maximum=100, default=50),
            group("seed")(
                NumberInput("Seed", minimum=None, maximum=None, default=0),
            ),
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
        noise_type: NoiseType,
        noise_color: NoiseColor,
        amount: int,
        seed: int,
    ) -> np.ndarray:
        if noise_type == NoiseType.GAUSSIAN:
            return gaussian_noise(img, amount / 100, noise_color, seed)
        elif noise_type == NoiseType.UNIFORM:
            return uniform_noise(img, amount / 100, noise_color, seed)
        elif noise_type == NoiseType.SALT_AND_PEPPER:
            return salt_and_pepper_noise(img, amount / 100, noise_color, seed)
        elif noise_type == NoiseType.POISSON:
            return poisson_noise(img, amount / 100, noise_color, seed)
        elif noise_type == NoiseType.SPECKLE:
            return speckle_noise(img, amount / 100, noise_color, seed)
        else:
            raise ValueError(f"Unknown noise type: {noise_type}")
