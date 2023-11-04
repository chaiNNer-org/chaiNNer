from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING

from chainner_ext import (
    fill_alpha_extend_color,
    fill_alpha_fragment_blur,
    fill_alpha_nearest_color,
)

import navi
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from . import node_group

if TYPE_CHECKING:
    import numpy as np


class AlphaFillMethod(Enum):
    EXTEND_TEXTURE = 1
    EXTEND_COLOR = 2
    NEAREST_COLOR = 3


@node_group.register(
    schema_id="chainner:image:fill_alpha",
    name="Fill Alpha",
    description=("Fills the transparent pixels of an image with nearby colors."),
    icon="MdOutlineFormatColorFill",
    inputs=[
        ImageInput("RGBA", channels=4),
        EnumInput(AlphaFillMethod, label="Fill Method"),
    ],
    outputs=[
        ImageOutput(
            "RGB",
            image_type=navi.Image(size_as="Input0"),
            channels=3,
        ),
    ],
)
def fill_alpha_node(img: np.ndarray, method: AlphaFillMethod) -> np.ndarray:
    """Fills transparent holes in the given image"""

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

    return img[:, :, :3]
