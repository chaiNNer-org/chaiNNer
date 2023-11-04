from __future__ import annotations

from typing import TYPE_CHECKING

from api import Iterator, IteratorOutputInfo
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput, NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import batch_processing_group

if TYPE_CHECKING:
    import numpy as np


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
        NumberOutput("Index", output_type="min(uint, Input1 * Input2 - 1)").with_docs(
            "A counter that starts at 0 and increments by 1 for each image."
        ),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 1], length_type="Input1 * Input2"),
    node_type="newIterator",
)
def split_spritesheet_node(
    sprite_sheet: np.ndarray,
    rows: int,
    columns: int,
) -> Iterator[tuple[np.ndarray, int]]:
    h, w, _ = get_h_w_c(sprite_sheet)
    assert (
        h % rows == 0
    ), "Height of sprite sheet must be a multiple of the number of rows"
    assert (
        w % columns == 0
    ), "Width of sprite sheet must be a multiple of the number of columns"

    individual_h = h // rows
    individual_w = w // columns

    def get_sprite(index: int):
        row = index // columns
        col = index % columns

        sprite = sprite_sheet[
            row * individual_h : (row + 1) * individual_h,
            col * individual_w : (col + 1) * individual_w,
        ]

        return sprite, index

    # We just need the index, so we can pass in a list of None's
    return Iterator.from_range(rows * columns, get_sprite)
