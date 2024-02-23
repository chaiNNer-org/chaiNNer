from __future__ import annotations

from enum import Enum

import numpy as np

import navi
from nodes.groups import if_enum_group, seed_group
from nodes.impl.image_utils import cartesian_product
from nodes.impl.noise_functions.blue import create_blue_noise
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
    VALUE = "值噪声"
    SIMPLEX = "Simplex"
    BLUE_NOISE = "蓝噪声"


class FractalMethod(Enum):
    NONE = "无"
    PINK = "粉红噪声"


def _add_noise(
    generator_class,  # noqa: ANN001
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
    name="创建噪声",
    description="创建一个指定尺寸的图像，填充各种噪声之一。",
    icon="MdFormatColorFill",
    inputs=[
        NumberInput("宽度", minimum=1, unit="px", default=256),
        NumberInput("高度", minimum=1, unit="px", default=256),
        seed_group(SeedInput()),
        EnumInput(
            NoiseMethod,
            default=NoiseMethod.SIMPLEX,
            option_labels={key: key.value for key in NoiseMethod},
        ).with_id(3),
        if_enum_group(3, (NoiseMethod.SIMPLEX, NoiseMethod.VALUE))(
            NumberInput("缩放", minimum=1, default=50, precision=1).with_id(4),
            SliderInput(
                "亮度", minimum=0, default=100, maximum=100, precision=2
            ).with_id(5),
            BoolInput("水平平铺", default=False).with_id(10),
            BoolInput("垂直平铺", default=False).with_id(11),
            BoolInput("球面平铺", default=False).with_id(12),
            EnumInput(
                FractalMethod,
                default=FractalMethod.NONE,
                option_labels={key: key.value for key in FractalMethod},
            ).with_id(6),
            if_enum_group(6, FractalMethod.PINK)(
                NumberInput("层数", minimum=2, default=3, precision=0).with_id(7),
                NumberInput("缩放比例", minimum=1, default=2, precision=2).with_id(8),
                NumberInput(
                    "亮度比例", minimum=1, default=2, precision=2
                ).with_id(9),
                BoolInput("增加种子", default=True).with_id(13),
            ),
        ),
        if_enum_group(3, NoiseMethod.BLUE_NOISE)(
            SliderInput(
                "标准差",
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
        _add_noise(generator_class, image=img, **kwargs)  # type: ignore
    elif fractal_method == FractalMethod.PINK:
        del kwargs["scale"], kwargs["brightness"]
        total_brightness = 0
        relative_brightness = 1
        for _ in range(layers):
            total_brightness += relative_brightness
            _add_noise(
                generator_class,
                image=img,
                **kwargs,  # type: ignore
                scale=scale,
                brightness=brightness * relative_brightness,
            )
            scale /= scale_ratio
            relative_brightness /= brightness_ratio
            if increment_seed:
                kwargs["seed"] = (kwargs["seed"] + 1) % (2**32)
        img /= total_brightness

    return img
