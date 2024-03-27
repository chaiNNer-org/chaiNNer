from __future__ import annotations

import numpy as np

from api import KeyInfo
from nodes.impl.image_utils import FlipAxis
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from .. import modification_group


@modification_group.register(
    schema_id="chainner:image:flip",
    name="Flip",
    description="Flip an image.",
    icon="MdFlip",
    inputs=[
        ImageInput("Image"),
        EnumInput(FlipAxis),
    ],
    outputs=[ImageOutput(image_type="Input0", assume_normalized=True)],
    key_info=KeyInfo.enum(1),
)
def flip_node(img: np.ndarray, axis: FlipAxis) -> np.ndarray:
    return axis.flip(img)
