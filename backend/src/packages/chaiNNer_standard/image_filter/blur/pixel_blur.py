from __future__ import annotations

import numpy as np
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import blur_group


@blur_group.register(
    schema_id="chainner:image:pixel_blur",
    name="Pixel Blur",
    description="Apply pixel blur to an image.",
    icon="MdBlurOn",
    inputs=[
        ImageInput(),
        NumberInput("Size X", controls_step=1),
        NumberInput("Size Y", controls_step=1),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def pixel_blur_node(
    img: np.ndarray,
    size_x: float,
    size_y: float,
) -> np.ndarray:
    if size_x == 0 and size_y == 0:
        return img

    block_sizes = (size_x, size_y)
    height, width = img.shape[:2]

    num_blocks_x = width // block_sizes[0]
    num_blocks_y = height // block_sizes[1]

    blocks = img[
        : num_blocks_y * block_sizes[1], : num_blocks_x * block_sizes[0]
    ].reshape((num_blocks_y, block_sizes[1], num_blocks_x, block_sizes[0], 3))

    average_colors = np.mean(np.mean(blocks, axis=1), axis=2)

    repeated_colors = np.repeat(
        np.repeat(average_colors, block_sizes[0], axis=1), block_sizes[1], axis=0
    )

    return repeated_colors
