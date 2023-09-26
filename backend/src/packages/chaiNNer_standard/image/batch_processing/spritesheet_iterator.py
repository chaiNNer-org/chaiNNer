from __future__ import annotations

import numpy as np

from api import Iterator
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import batch_processing_group


@batch_processing_group.register(
    schema_id="chainner:image:spritesheet_iterator",
    name="Spritesheet Iterator",
    description=[
        "Iterate over sub-images in a single image spritesheet.",
        "This iterator splits the image into tiles that it then runs your iterator chain on, and then recombines the tiles into a single image.",
    ],
    icon="MdLoop",
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
    outputs=[ImageOutput()],
    node_type="newIterator",
)
def spritesheet_iterator_node(
    sprite_sheet: np.ndarray,
    rows: int,
    columns: int,
) -> Iterator[np.ndarray]:
    h, w, _ = get_h_w_c(sprite_sheet)
    assert (
        h % rows == 0
    ), "Height of sprite sheet must be a multiple of the number of rows"
    assert (
        w % columns == 0
    ), "Width of sprite sheet must be a multiple of the number of columns"

    individual_h = h // rows
    individual_w = w // columns

    def iterator():
        for row in range(rows):
            for col in range(columns):
                # Split sprite sheet into a single list of images
                yield sprite_sheet[
                    row * individual_h : (row + 1) * individual_h,
                    col * individual_w : (col + 1) * individual_w,
                ]

    return Iterator(iter_supplier=iterator, expected_length=rows * columns)
