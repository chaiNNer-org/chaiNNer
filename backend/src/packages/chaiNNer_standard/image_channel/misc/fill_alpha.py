from __future__ import annotations

from enum import Enum

import numpy as np

import navi
from nodes.impl.fill_alpha import (
    convert_to_binary_alpha,
    fill_alpha_edge_extend,
    fill_alpha_fragment_blur,
)
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from . import node_group


class AlphaFillMethod(Enum):
    EXTEND_TEXTURE = 1
    EXTEND_COLOR = 2


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

    img = img.copy()
    if method == AlphaFillMethod.EXTEND_TEXTURE:
        # Preprocess to convert the image into binary alpha
        convert_to_binary_alpha(img)
        img = fill_alpha_fragment_blur(img)

        convert_to_binary_alpha(img)
        img = fill_alpha_edge_extend(img, 8)
    elif method == AlphaFillMethod.EXTEND_COLOR:
        convert_to_binary_alpha(img)
        img = fill_alpha_edge_extend(img, 40)
    else:
        assert False, f"Invalid alpha fill method {method}"

    # Finally, add a black background and convert to RGB
    img[:, :, 0] *= img[:, :, 3]
    img[:, :, 1] *= img[:, :, 3]
    img[:, :, 2] *= img[:, :, 3]
    return img[:, :, :3]
