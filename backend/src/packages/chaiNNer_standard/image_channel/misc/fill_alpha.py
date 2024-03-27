from __future__ import annotations

from enum import Enum

import numpy as np
from chainner_ext import (
    fill_alpha_extend_color,
    fill_alpha_fragment_blur,
    fill_alpha_nearest_color,
)

import navi
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


class AlphaFillMethod(Enum):
    EXTEND_TEXTURE = 1
    EXTEND_COLOR = 2
    NEAREST_COLOR = 3


@miscellaneous_group.register(
    schema_id="chainner:image:fill_alpha",
    name="Fill Alpha",
    description="Splits the image into color and transparency, and fills the transparent pixels of an image with nearby colors.",
    icon="MdOutlineFormatColorFill",
    inputs=[
        ImageInput(channels=4),
        EnumInput(AlphaFillMethod, label="Fill Method"),
    ],
    outputs=[
        ImageOutput(
            "RGB",
            image_type=navi.Image(size_as="Input0"),
            channels=3,
        ),
        ImageOutput(
            "Alpha",
            image_type=navi.Image(size_as="Input0"),
            channels=1,
        ),
    ],
)
def fill_alpha_node(
    img: np.ndarray, method: AlphaFillMethod
) -> tuple[np.ndarray, np.ndarray]:
    alpha = img[:, :, 3]

    if method == AlphaFillMethod.EXTEND_TEXTURE:
        img = fill_alpha_fragment_blur(
            img,
            threshold=0.05,
            iterations=6,
            fragment_count=5,
        )
        img = fill_alpha_extend_color(img, threshold=0.05, iterations=100_000)
    elif method == AlphaFillMethod.EXTEND_COLOR:
        img = fill_alpha_extend_color(img, threshold=0.05, iterations=100_000)
    elif method == AlphaFillMethod.NEAREST_COLOR:
        img = fill_alpha_nearest_color(
            img,
            threshold=0.05,
            min_radius=100_000,
            anti_aliasing=True,
        )
    else:
        raise AssertionError(f"Invalid alpha fill method {method}")

    return img[:, :, :3], alpha
