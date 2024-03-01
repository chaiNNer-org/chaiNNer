from __future__ import annotations

from enum import Enum
from typing import Callable

import numpy as np

import navi
from nodes.groups import if_enum_group, seed_group
from nodes.impl.image_utils import cartesian_product
from nodes.impl.noise_functions.blue import create_blue_noise
from nodes.impl.noise_functions.noise_generator import NoiseGenerator
from nodes.impl.noise_functions.simplex import SimplexNoise
from nodes.impl.noise_functions.value import ValueNoise
from nodes.properties.inputs import (
    BoolInput,
    EnumInput,
    NumberInput,
    SeedInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.seed import Seed

from .. import create_images_group


class NoiseMethod(Enum):
    VALUE_NOISE = "Value Noise"
    SMOOTH_VALUE_NOISE = "Smooth Value Noise"
    SIMPLEX = "Simplex"
    BLUE_NOISE = "Blue Noise"


class FractalMethod(Enum):
    NONE = "None"
    PINK_NOISE = "Pink noise"


def _generate_noise(
    generator: Callable[[int], NoiseGenerator],
    width: int,
    height: int,
    scale: float,
    brightness: float,
    tile_horizontal: bool = False,
    tile_vertical: bool = False,
    tile_spherical: bool = False,
):
    h, w = height, width
    pixels = cartesian_product([np.arange(h), np.arange(w)])
    points = np.array(pixels)
    if tile_spherical:
        tile_horizontal = False
        tile_vertical = False
    if tile_horizontal:
        x = points[:, 1] * 2 * np.pi / w
        cx = (w * np.cos(x) / np.pi / 2).reshape((-1, 1))
        sx = (w * np.sin(x) / np.pi / 2).reshape((-1, 1))
        points = np.concatenate([points[:, :1], cx, sx], axis=1)
    if tile_vertical:
        x = points[:, 0] * 2 * np.pi / h
        cx = (h * np.cos(x) / np.pi / 2).reshape((-1, 1))
        sx = (h * np.sin(x) / np.pi / 2).reshape((-1, 1))
        points = np.concatenate([points[:, 1:], cx, sx], axis=1)
    if tile_spherical:
        theta = points[:, 0] * np.pi / h
        alpha = points[:, 1] * 2 * np.pi / w

        y = w * np.cos(theta).reshape((-1, 1)) / np.pi / 2
        r = h * np.sin(theta).reshape((-1, 1))

        x = r * np.cos(alpha).reshape((-1, 1)) / np.pi / 2
        z = r * np.sin(alpha).reshape((-1, 1)) / np.pi / 2

        points = np.concatenate([x, y, z], axis=1)

    output = generator(points.shape[1]).evaluate(points / scale)

    return output.reshape((h, w)) * brightness


@create_images_group.register(
    schema_id="chainner:image:create_noise",
    name="Create Noise",
    description="Create an image of specified dimensions filled with one of a variety of noises.",
    icon="MdFormatColorFill",
    inputs=[
        NumberInput("Width", minimum=1, unit="px", default=256),
        NumberInput("Height", minimum=1, unit="px", default=256),
        seed_group(SeedInput()),
        EnumInput(
            NoiseMethod,
            default=NoiseMethod.SIMPLEX,
            option_labels={NoiseMethod.SMOOTH_VALUE_NOISE: "Value Noise (smooth)"},
        ).with_id(3),
        if_enum_group(
            3,
            (
                NoiseMethod.SIMPLEX,
                NoiseMethod.VALUE_NOISE,
                NoiseMethod.SMOOTH_VALUE_NOISE,
            ),
        )(
            NumberInput("Scale", minimum=1, default=50, precision=1).with_id(4),
            SliderInput(
                "Brightness", minimum=0, default=100, maximum=100, precision=2
            ).with_id(5),
            BoolInput("Tile Horizontal", default=False).with_id(10),
            BoolInput("Tile Vertical", default=False).with_id(11),
            BoolInput("Tile Spherical", default=False).with_id(12),
            EnumInput(FractalMethod, default=FractalMethod.NONE).with_id(6),
            if_enum_group(6, FractalMethod.PINK_NOISE)(
                NumberInput(
                    "Layers", minimum=2, maximum=20, default=3, precision=0
                ).with_id(7),
                NumberInput("Scale Ratio", minimum=1, default=2, precision=2).with_id(
                    8
                ),
                NumberInput(
                    "Brightness Ratio", minimum=1, default=2, precision=2
                ).with_id(9),
                BoolInput("Increment Seed", default=True).with_id(13),
            ),
        ),
        if_enum_group(3, NoiseMethod.BLUE_NOISE)(
            SliderInput(
                "Standard Deviation",
                minimum=1,
                maximum=100,
                default=1.5,
                precision=3,
                scale="log-offset",
            ).with_id(14)
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="Input0",
                height="Input1",
            ),
            channels=1,
        )
    ],
)
def create_noise_node(
    width: int,
    height: int,
    seed_obj: Seed,
    noise_method: NoiseMethod,
    scale: float,
    brightness: float,
    tile_horizontal: bool,
    tile_vertical: bool,
    tile_spherical: bool,
    fractal_method: FractalMethod,
    layers: int,
    scale_ratio: float,
    brightness_ratio: float,
    increment_seed: bool,
    standard_deviation: float,
) -> np.ndarray:
    brightness /= 100
    seed = seed_obj.to_u32()

    if noise_method == NoiseMethod.BLUE_NOISE:
        return create_blue_noise(
            (height, width),
            standard_deviation=standard_deviation,
            seed=seed_obj.to_u32(),
        ).astype(np.float32) / (width * height - 1)

    generator_class: Callable[[int, int], NoiseGenerator]
    if noise_method == NoiseMethod.SIMPLEX:
        generator_class = SimplexNoise
    elif noise_method == NoiseMethod.VALUE_NOISE:
        generator_class = lambda dim, seed: ValueNoise(dim, seed, smooth=False)  # noqa: E731
    elif noise_method == NoiseMethod.SMOOTH_VALUE_NOISE:
        generator_class = lambda dim, seed: ValueNoise(dim, seed, smooth=True)  # noqa: E731

    if fractal_method == FractalMethod.NONE:
        return _generate_noise(
            lambda dim: generator_class(dim, seed),
            width=width,
            height=height,
            scale=scale,
            brightness=brightness,
            tile_horizontal=tile_horizontal,
            tile_vertical=tile_vertical,
            tile_spherical=tile_spherical,
        )

    if fractal_method == FractalMethod.PINK_NOISE:
        img = np.zeros((height, width), dtype=np.float32)
        total_brightness = 0
        for i in range(layers):
            rel_brightness = 1 / (brightness_ratio**i)
            total_brightness += rel_brightness
            img += _generate_noise(
                lambda dim: generator_class(dim, seed),  # noqa: B023
                width=width,
                height=height,
                scale=scale / (scale_ratio**i),
                brightness=brightness * rel_brightness,
                tile_horizontal=tile_horizontal,
                tile_vertical=tile_vertical,
                tile_spherical=tile_spherical,
            )
            if increment_seed:
                seed += 1
        img /= total_brightness
        return img
