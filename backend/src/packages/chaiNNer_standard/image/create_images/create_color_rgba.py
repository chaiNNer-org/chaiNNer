from __future__ import annotations

import numpy as np

from nodes.properties import expression
from nodes.properties.inputs import NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import create_images_group


@create_images_group.register(
    schema_id="chainner:image:create_color_rgba",
    name="Create Color (RGBA)",
    description="Create an image of specified dimensions filled with a specified RGBA color.",
    icon="MdFormatColorFill",
    inputs=[
        NumberInput("Width", minimum=1, unit="px", default=1),
        NumberInput("Height", minimum=1, unit="px", default=1),
        SliderInput(
            "Red",
            minimum=0,
            maximum=255,
            default=126,
            gradient=["#000000", "#ff0000"],
        ),
        SliderInput(
            "Green",
            minimum=0,
            maximum=255,
            default=126,
            gradient=["#000000", "#00ff00"],
        ),
        SliderInput(
            "Blue",
            minimum=0,
            maximum=255,
            default=126,
            gradient=["#000000", "#0000ff"],
        ),
        SliderInput(
            "Alpha",
            minimum=0,
            maximum=255,
            default=126,
            gradient=["#000000", "#ffffff"],
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=expression.Image(
                width="Input0",
                height="Input1",
                channels="4",
            ),
            assume_normalized=True,
        )
    ],
)
def create_color_node(
    width: int, height: int, red: int, green: int, blue: int, alpha: int
) -> np.ndarray:
    return np.full(
        (height, width, 4),
        (blue / 255, green / 255, red / 255, alpha / 255),
        dtype=np.float32,
    )
