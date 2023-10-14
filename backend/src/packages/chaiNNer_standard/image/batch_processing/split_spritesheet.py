from __future__ import annotations

from typing import Tuple

import numpy as np

from api import Iterator
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput, NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import batch_processing_group


@batch_processing_group.register(
    schema_id="chainner:image:split_spritesheet",
    name="Split Spritesheet",
    description=[
        "Iterate over sub-images in a single image spritesheet.",
        "This iterator splits the image into an iterable sequence of tiles.",
    ],
    icon="BsFillGrid3X3GapFill",
    inputs=[
        ImageInput("Spritesheet"),
        NumberInput(
            "Number of rows (height)",
            controls_step=1,
            minimum=1,
            default=1,
        ).with_docs(
            "The number of rows to split the image into. The height of the image must be a multiple of this number."
        ),
        NumberInput(
            "Number of columns (width)",
            controls_step=1,
            minimum=1,
            default=1,
        ).with_docs(
            "The number of columns to split the image into. The width of the image must be a multiple of this number."
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
            Image {
                height: max(floor(Input0.height / Input1), 1),
                width: max(floor(Input0.width / Input2), 1),
                channels: Input0.channels,
            }"""
        ),
        NumberOutput("Index", output_type="uint").with_docs(
            "A counter that starts at 0 and increments by 1 for each image."
        ),
    ],
    node_type="newIterator",
)
def split_spritesheet_node(
    sprite_sheet: np.ndarray,
    rows: int,
    columns: int,
) -> Iterator[Tuple[np.ndarray, int]]:
    h, w, _ = get_h_w_c(sprite_sheet)
    assert (
        h % rows == 0
    ), "Height of sprite sheet must be a multiple of the number of rows"
    assert (
        w % columns == 0
    ), "Width of sprite sheet must be a multiple of the number of columns"

    individual_h = h // rows
    individual_w = w // columns

    def get_sprite(_, index: int):
        row = index // columns
        col = index % columns

        sprite = sprite_sheet[
            row * individual_h : (row + 1) * individual_h,
            col * individual_w : (col + 1) * individual_w,
        ]

        return sprite, index

    # We just need the index, so we can pass in a list of None's
    return Iterator.from_list([None] * (rows * columns), get_sprite)
