from __future__ import annotations

import numpy as np

from nodes.impl.color.color import Color
from nodes.impl.image_utils import as_target_channels
from nodes.properties.inputs import ColorInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import create_images_group


@create_images_group.register(
    schema_id="chainner:image:create_checkerboard",
    name="Create Checkerboard",
    description="Create a Checkerboard of specified dimensions filled with the given colors for the squares.",
    icon="MdBorderAll",
    inputs=[
        NumberInput("Width", minimum=1, unit="px", default=1024),
        NumberInput("Height", minimum=1, unit="px", default=1024),
        ColorInput(
            "Color 1", channels=[1, 3, 4], default=Color.bgr((0.75, 0.75, 0.75))
        ).with_id(2),
        ColorInput(
            "Color 2", channels=[1, 3, 4], default=Color.bgr((0.35, 0.35, 0.35))
        ).with_id(3),
        NumberInput("Square Size", minimum=1, default=32),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                Image {
                    width: Input0,
                    height: Input1,
                    channels: max(Input2.channels, Input3.channels),
                }""",
        )
    ],
)
def create_checkerboard_node(
    width: int,
    height: int,
    color_1: Color,
    color_2: Color,
    square_size: int,
) -> np.ndarray:
    img = np.zeros(
        (height, width, 4), dtype=np.float32
    )  # Create a new buffer with all zeros

    # Determine the number of squares in each direction
    num_cols = (width + square_size - 1) // square_size
    num_rows = (height + square_size - 1) // square_size

    max_channels = max(color_1.channels, color_2.channels)

    color_a = Color.from_1x1_image(
        as_target_channels(color_1.to_1x1_image(), max_channels)
    )
    color_b = Color.from_1x1_image(
        as_target_channels(color_2.to_1x1_image(), max_channels)
    )

    # Fill the checkerboard with alternating squares
    for i in range(num_rows):
        for j in range(num_cols):
            if (i + j) % 2 == 0:
                img[
                    max(0, height - (i + 1) * square_size) : max(
                        0, height - i * square_size
                    ),
                    j * square_size : min(width, (j + 1) * square_size),
                ] = color_a.value
            else:
                img[
                    max(0, height - (i + 1) * square_size) : max(
                        0, height - i * square_size
                    ),
                    j * square_size : min(width, (j + 1) * square_size),
                ] = color_b.value

    return img
