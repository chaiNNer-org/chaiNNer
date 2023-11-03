from __future__ import annotations

import numpy as np

import navi
from nodes.groups import if_enum_group
from nodes.impl.color.color import Color
from nodes.impl.image_utils import BorderType, create_border
from nodes.properties.inputs import BorderInput, ColorInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding

from .. import border_group


@border_group.register(
    schema_id="chainner:image:create_edges",
    name="Create Edges",
    description="Creates a border around the image with different values per edge.",
    icon="BsBorderOuter",
    inputs=[
        ImageInput(),
        BorderInput().with_id(1),
        if_enum_group(1, BorderType.CUSTOM_COLOR)(
            ColorInput().with_id(6),
        ),
        NumberInput("Top", unit="px").with_id(2),
        NumberInput("Left", unit="px").with_id(3),
        NumberInput("Right", unit="px").with_id(4),
        NumberInput("Bottom", unit="px").with_id(5),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.image(
                width="Input0.width + Input3 + Input4",
                height="Input0.height + Input2 + Input5",
                channels="BorderType::getOutputChannels(Input1, Input0.channels, Input6)",
            ),
            assume_normalized=True,
        )
    ],
)
def create_edges_node(
    img: np.ndarray,
    border_type: BorderType,
    color: Color,
    top: int,
    left: int,
    right: int,
    bottom: int,
) -> np.ndarray:
    return create_border(
        img, border_type, Padding(top, right, bottom, left), color=color
    )
