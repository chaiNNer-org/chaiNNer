from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.impl.image_utils import as_target_channels
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


class AlphaAssociation(Enum):
    UNPREMULTIPLY_RGB = "Unpremultiply RGB"
    PREMULTIPLY_RGB = "Premulitply RGB"


@adjustments_group.register(
    schema_id="chainner:image:premultiplied_alpha",
    description="Divide (or multiply) the RGB channels with the Alpha channel values of an image to go from a Straight Alpha to a Premultiplied Alpha image state.",
    name="Premultiplied Alpha",
    icon="CgMathDivide",
    inputs=[
        ImageInput(),
        EnumInput(AlphaAssociation, label="Alpha Association"),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def premultiplied_alpha_node(
    img: np.ndarray, alpha_association: AlphaAssociation
) -> np.ndarray:
    if len(img.shape) != 3:
        return img, np.ones(img.shape[:2], dtype="float32")

    img = as_target_channels(img, 4)

    rgb = img[..., :3]
    alpha = img[..., 3]

    if alpha_association == AlphaAssociation.UNPREMULTIPLY_RGB:
        rgb_divided = rgb / alpha[..., np.newaxis]
        return np.concatenate((rgb_divided, alpha[..., np.newaxis]), axis=-1)
    elif alpha_association == AlphaAssociation.PREMULTIPLY_RGB:
        rgb_multed = rgb * alpha[..., np.newaxis]
        return np.concatenate((rgb_multed, alpha[..., np.newaxis]), axis=-1)
    else:
        raise ValueError(f"Invalid Alpha Association State '{alpha_association}'.")
