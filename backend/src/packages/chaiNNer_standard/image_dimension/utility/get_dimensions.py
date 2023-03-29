from __future__ import annotations

from typing import Tuple

import numpy as np

from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import utility_group


@utility_group.register(
    schema_id="chainner:image:get_dims",
    name="Get Dimensions",
    description=("Get the Height, Width, and number of Channels from an image."),
    icon="BsRulers",
    inputs=[
        ImageInput(),
    ],
    outputs=[
        NumberOutput("Width", output_type="Input0.width"),
        NumberOutput("Height", output_type="Input0.height"),
        NumberOutput("Channels", output_type="Input0.channels"),
    ],
)
def get_dimensions_node(
    img: np.ndarray,
) -> Tuple[int, int, int]:
    h, w, c = get_h_w_c(img)
    return w, h, c
