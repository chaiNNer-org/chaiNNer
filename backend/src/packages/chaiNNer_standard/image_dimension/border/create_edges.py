from __future__ import annotations

import numpy as np

from nodes.impl.image_utils import BorderType, create_border
from nodes.properties import expression
from nodes.properties.inputs import BorderInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding

from .. import border_group


@border_group.register(
    schema_id="chainner:image:create_edges",
    name="Create Edges",
    description="Creates an edge border around the image.",
    icon="BsBorderOuter",
    inputs=[
        ImageInput(),
        BorderInput(),
        NumberInput("Top", unit="px"),
        NumberInput("Left", unit="px"),
        NumberInput("Right", unit="px"),
        NumberInput("Bottom", unit="px"),
    ],
    outputs=[
        ImageOutput(
            image_type=expression.Image(
                width="Input0.width + Input3 + Input4",
                height="Input0.height + Input2 + Input5",
                channels="BorderType::getOutputChannels(Input1, Input0.channels)",
            )
        )
    ],
)
def create_edges_node(
    img: np.ndarray,
    border_type: BorderType,
    top: int,
    left: int,
    right: int,
    bottom: int,
) -> np.ndarray:
    return create_border(img, border_type, Padding(top, right, bottom, left))
