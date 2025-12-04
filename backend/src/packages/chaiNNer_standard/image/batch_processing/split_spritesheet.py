from __future__ import annotations

import numpy as np

from api import Generator, IteratorOutputInfo
from nodes.properties.inputs import ImageInput, NumberInput, OrderEnum, RowOrderDropdown
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
        NumberInput("Number of rows (height)", min=1, default=1).with_docs(
            "The number of rows to split the image into. The height of the image must be a multiple of this number."
        ),
        NumberInput("Number of columns (width)", min=1, default=1).with_docs(
            "The number of columns to split the image into. The width of the image must be a multiple of this number."
        ),
        RowOrderDropdown().with_docs(
            """The order in which the images are separated.
Examples:
```
Row major:    Column major:
→ 0 1 2       ↓ 0 3 6
  3 4 5         1 4 7
  6 7 8         2 5 8
```""",
            hint=True,
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
    kind="generator",
)
def split_spritesheet_node(
    sprite_sheet: np.ndarray,
    rows: int,
    columns: int,
    order: OrderEnum,
) -> Generator[tuple[np.ndarray, int]]:
    h, w, _ = get_h_w_c(sprite_sheet)
    assert h % rows == 0, (
        "Height of sprite sheet must be a multiple of the number of rows"
    )
    assert w % columns == 0, (
        "Width of sprite sheet must be a multiple of the number of columns"
    )

    individual_h = h // rows
    individual_w = w // columns

    def get_sprite(index: int):
        if order == OrderEnum.ROW_MAJOR:
            row = index // columns
            col = index % columns
        elif order == OrderEnum.COLUMN_MAJOR:
            col = index // rows
            row = index % rows
        else:
            raise ValueError(f"Invalid order: {order}")

        sprite = sprite_sheet[
            row * individual_h : (row + 1) * individual_h,
            col * individual_w : (col + 1) * individual_w,
        ]
        return sprite, index

    # We just need the index, so we can pass in a list of None's
    return Generator.from_range(rows * columns, get_sprite)
