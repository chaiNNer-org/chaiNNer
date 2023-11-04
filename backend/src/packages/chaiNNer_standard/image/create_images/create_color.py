from __future__ import annotations

from typing import TYPE_CHECKING

import navi
from nodes.properties.inputs import ColorInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import create_images_group

if TYPE_CHECKING:
    import numpy as np

    from nodes.impl.color.color import Color


@create_images_group.register(
    schema_id="chainner:image:create_color",
    name="Create Color",
    description="Create an image of specified dimensions filled with the given color.",
    icon="MdFormatColorFill",
    inputs=[
        ColorInput(),
        NumberInput("Width", minimum=1, unit="px", default=1),
        NumberInput("Height", minimum=1, unit="px", default=1),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="Input1",
                height="Input2",
                channels="Input0.channels",
            ),
            assume_normalized=True,
        )
    ],
)
def create_color_node(color: Color, width: int, height: int) -> np.ndarray:
    return color.to_image(width, height)
