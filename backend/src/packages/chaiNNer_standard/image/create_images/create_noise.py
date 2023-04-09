from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.group import group
from nodes.groups import if_enum_group
from nodes.impl.image_utils import cartesian_product
from nodes.impl.noise_functions.blue import create_blue_noise
from nodes.impl.noise_functions.simplex import SimplexNoise
from nodes.impl.noise_functions.value import ValueNoise
from nodes.properties import expression
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
    VALUE = "Value Noise"
    SIMPLEX = "Simplex"
    BLUE_NOISE = "Blue Noise"


class FractalMethod(Enum):
    NONE = "None"
    PINK = "Pink noise"


def _add_noise(
    generator_class,
    image: np.ndarray,
    scale: float,
    brightness: float,
    tile_horizontal: bool = False,
    tile_vertical: bool = False,
    tile_spherical: bool = False,
    **kwargs,
):
    pixels = cartesian_product([np.arange(image.shape[0]), np.arange(image.shape[1])])
    points = np.array(pixels)
    if tile_spherical:
        tile_horizontal = False
        tile_vertical = False
    if tile_horizontal:
        x = points[:, 1] * 2 * np.pi / image.shape[1]
        cx = (image.shape[1] * np.cos(x) / np.pi / 2).reshape((-1, 1))
        sx = (image.shape[1] * np.sin(x) / np.pi / 2).reshape((-1, 1))
        points = np.concatenate([points[:, :1], cx, sx], axis=1)
    if tile_vertical:
        x = points[:, 0] * 2 * np.pi / image.shape[0]
        cx = (image.shape[0] * np.cos(x) / np.pi / 2).reshape((-1, 1))
        sx = (image.shape[0] * np.sin(x) / np.pi / 2).reshape((-1, 1))
        points = np.concatenate([points[:, 1:], cx, sx], axis=1)
    if tile_spherical:
        theta = points[:, 0] * np.pi / image.shape[0]
        alpha = points[:, 1] * 2 * np.pi / image.shape[1]

        y = image.shape[1] * np.cos(theta).reshape((-1, 1)) / np.pi / 2
        r = image.shape[0] * np.sin(theta).reshape((-1, 1))

        x = r * np.cos(alpha).reshape((-1, 1)) / np.pi / 2
        z = r * np.sin(alpha).reshape((-1, 1)) / np.pi / 2

        points = np.concatenate([x, y, z], axis=1)

    gen = generator_class(dimensions=points.shape[1], **kwargs)
    output = gen.evaluate(points / scale)

    image += output.reshape(image.shape) * brightness


@create_images_group.register(
    schema_id="chainner:image:create_noise",
    name="Create Noise",
    description="Create an image of specified dimensions filled with one of a variety of noises.",
    icon="MdFormatColorFill",
    inputs=[
        NumberInput("Width", minimum=1, unit="px", default=256),
        NumberInput("Height", minimum=1, unit="px", default=256),
        group("seed")(SeedInput()),
        EnumInput(
            NoiseMethod,
            default_value=NoiseMethod.SIMPLEX,
            option_labels={key: key.value for key in NoiseMethod},
        ).with_id(3),
        if_enum_group(3, (NoiseMethod.SIMPLEX, NoiseMethod.VALUE))(
            NumberInput("Scale", minimum=1, default=50, precision=1).with_id(4),
            SliderInput(
                "Brightness", minimum=0, default=100, maximum=100, precision=2
            ).with_id(5),
            BoolInput("Tile Horizontal", default=False).with_id(10),
            BoolInput("Tile Vertical", default=False).with_id(11),
            BoolInput("Tile Spherical", default=False).with_id(12),
            EnumInput(
                FractalMethod,
                default_value=FractalMethod.NONE,
                option_labels={key: key.value for key in FractalMethod},
            ).with_id(6),
            if_enum_group(6, FractalMethod.PINK)(
                NumberInput("Layers", minimum=2, default=3, precision=0).with_id(7),
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
            image_type=expression.Image(
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
    seed: Seed,
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
    if noise_method == NoiseMethod.BLUE_NOISE:
        return create_blue_noise(
            (height, width),
            standard_deviation=standard_deviation,
            seed=seed.to_u32(),
        ).astype(np.float32) / (width * height - 1)

    img = np.zeros((height, width), dtype=np.float32)
    brightness /= 100

    kwargs = {
        "tile_horizontal": tile_horizontal,
        "tile_vertical": tile_vertical,
        "tile_spherical": tile_spherical,
        "scale": scale,
        "brightness": brightness,
        "seed": seed.to_u32(),
    }

    generator_class = None
    if noise_method == NoiseMethod.SIMPLEX:
        generator_class = SimplexNoise
    elif noise_method == NoiseMethod.VALUE:
        generator_class = ValueNoise

    if fractal_method == FractalMethod.NONE:
        _add_noise(generator_class, image=img, **kwargs)
    elif fractal_method == FractalMethod.PINK:
        del kwargs["scale"], kwargs["brightness"]
        total_brightness = 0
        relative_brightness = 1
        for _ in range(layers):
            total_brightness += relative_brightness
            _add_noise(
                generator_class,
                image=img,
                **kwargs,
                scale=scale,
                brightness=brightness * relative_brightness,
            )
            scale /= scale_ratio
            relative_brightness /= brightness_ratio
            if increment_seed:
                kwargs["seed"] = (kwargs["seed"] + 1) % (2**32)
        img /= total_brightness

    return img
