from __future__ import annotations

import numpy as np

import navi
from nodes.impl.image_utils import FillColor, shift
from nodes.properties.inputs import FillColorDropdown, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import modification_group


@modification_group.register(
    schema_id="chainner:image:shift",
    name="Shift",
    description="Shift an image by an x, y amount.",
    icon="BsGraphDown",
    inputs=[
        ImageInput(),
        NumberInput("Amount X", minimum=None, unit="px"),
        NumberInput("Amount Y", minimum=None, unit="px"),
        FillColorDropdown(),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.image(
                width="Input0.width",
                height="Input0.height",
                channels="FillColor::getOutputChannels(Input3, Input0.channels)",
            ),
            assume_normalized=True,
        )
    ],
)
def shift_node(
    img: np.ndarray,
    amount_x: int,
    amount_y: int,
    fill: FillColor,
) -> np.ndarray:
    return shift(img, amount_x, amount_y, fill)
