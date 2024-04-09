from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from .. import arithmetic_group


class AlphaAssociation(Enum):
    PREMULTIPLY_RGB = "Straight -> Premultiplied"
    UNPREMULTIPLY_RGB = "Premultiplied -> Straight"


@arithmetic_group.register(
    schema_id="chainner:image:premultiplied_alpha",
    description="Converts an RGBA Input from a Straight Alpha Association to a Premultiplied Alpha Association, or vice versa.",
    name="Premultiplied Alpha",
    icon="CgMathDivide",
    inputs=[
        ImageInput(channels=[4]),
        EnumInput(
            AlphaAssociation,
            label="Alpha Association Conversion",
            default=AlphaAssociation.PREMULTIPLY_RGB,
            option_labels={
                AlphaAssociation.PREMULTIPLY_RGB: "Straight → Premultiplied",
                AlphaAssociation.UNPREMULTIPLY_RGB: "Premultiplied → Straight",
            },
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def premultiplied_alpha_node(
    img: np.ndarray, alpha_association: AlphaAssociation
) -> np.ndarray:
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
