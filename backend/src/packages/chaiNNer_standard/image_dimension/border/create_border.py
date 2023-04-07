from __future__ import annotations

import numpy as np

from nodes.impl.image_utils import BorderType, create_border
from nodes.properties import expression
from nodes.properties.inputs import BorderInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding

from .. import border_group


@border_group.register(
    schema_id="chainner:image:create_border",
    name="Create Border",
    description="Creates a border around the image.",
    icon="BsBorderOuter",
    inputs=[
        ImageInput(),
        BorderInput(),
        NumberInput("Amount", unit="px"),
    ],
    outputs=[
        ImageOutput(
            image_type=expression.Image(
                width="Input0.width + Input2 * 2",
                height="Input0.height + Input2 * 2",
                channels="BorderType::getOutputChannels(Input1, Input0.channels)",
            ),
            assume_normalized=True,
        )
    ],
)
def create_border_node(
    img: np.ndarray, border_type: BorderType, amount: int
) -> np.ndarray:
    return create_border(img, border_type, Padding.all(amount))
