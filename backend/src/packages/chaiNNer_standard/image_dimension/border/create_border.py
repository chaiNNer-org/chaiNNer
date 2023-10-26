from __future__ import annotations

import navi
import numpy as np
from nodes.groups import if_enum_group
from nodes.impl.color.color import Color
from nodes.impl.image_utils import BorderType, create_border
from nodes.properties.inputs import BorderInput, ColorInput, ImageInput, NumberInput
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
        BorderInput().with_id(1),
        if_enum_group(1, BorderType.CUSTOM_COLOR)(
            ColorInput().with_id(3),
        ),
        NumberInput("Amount", unit="px").with_id(2),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="Input0.width + Input2 * 2",
                height="Input0.height + Input2 * 2",
                channels="BorderType::getOutputChannels(Input1, Input0.channels, Input3)",
            ),
            assume_normalized=True,
        )
    ],
)
def create_border_node(
    img: np.ndarray,
    border_type: BorderType,
    color: Color,
    amount: int,
) -> np.ndarray:
    return create_border(img, border_type, Padding.all(amount), color=color)
