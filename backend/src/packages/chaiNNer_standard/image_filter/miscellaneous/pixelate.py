from __future__ import annotations

import cv2
import numpy as np
from nodes.groups import linked_inputs_group
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:pixelate",
    name="Pixelate",
    description="Pixelate an image.",
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput(),
        linked_inputs_group(
            SliderInput("Size X", minimum=1, maximum=1024, default=10, scale="log"),
            SliderInput("Size Y", minimum=1, maximum=1024, default=10, scale="log"),
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def pixelate_node(
    img: np.ndarray,
    size_x: int,
    size_y: int,
) -> np.ndarray:
    block_sizes = (size_x, size_y)
    height, width = img.shape[:2]

    pad_x = (block_sizes[0] - width % block_sizes[0]) % block_sizes[0]
    pad_y = (block_sizes[1] - height % block_sizes[1]) % block_sizes[1]
    img = cv2.copyMakeBorder(img, 0, pad_y, 0, pad_x, cv2.BORDER_REFLECT_101)

    num_blocks_x = width // block_sizes[0]
    num_blocks_y = height // block_sizes[1]

    blocks = img[: num_blocks_y * block_sizes[1], : num_blocks_x * block_sizes[0]]
    blocks = (
        blocks.reshape(
            (num_blocks_y, block_sizes[1], num_blocks_x, block_sizes[0], img.shape[-1])
        )
        if len(img.shape) > 2
        else blocks.reshape(
            (num_blocks_y, block_sizes[1], num_blocks_x, block_sizes[0])
        )
    )

    average_colors = np.mean(np.mean(blocks, axis=1), axis=2)  # type: ignore

    repeated_colors = np.repeat(
        np.repeat(average_colors, block_sizes[0], axis=1), block_sizes[1], axis=0
    )

    return repeated_colors[:height, :width]
