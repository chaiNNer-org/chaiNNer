from __future__ import annotations

import numpy as np

from api import Collector, IteratorInputInfo
from nodes.properties.inputs import ImageInput, NumberInput, OrderEnum, RowOrderDropdown
from nodes.properties.outputs import ImageOutput

from .. import batch_processing_group


@batch_processing_group.register(
    schema_id="chainner:image:merge_spritesheet",
    name="Merge Spritesheet",
    description=[
        "Combines an iterable sequence into a single image spritesheet.",
    ],
    icon="BsGrid3X3",
    inputs=[
        ImageInput("Image Sequence"),
        NumberInput("Number of rows (height)", min=1, default=1).with_docs(
            "The number of rows to split the image into. The height of the image must be a multiple of this number."
        ),
        NumberInput("Number of columns (width)", min=1, default=1).with_docs(
            "The number of columns to split the image into. The width of the image must be a multiple of this number."
        ),
        RowOrderDropdown().with_docs(
            """The order in which the images are combined.
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
    iterator_inputs=IteratorInputInfo(inputs=0),
    outputs=[
        ImageOutput(
            image_type="""
            Image {
                height: max(Input0.height * Input1, 1),
                width: max(Input0.width * Input2, 1),
                channels: Input0.channels,
            }"""
        )
    ],
    kind="collector",
)
def merge_spritesheet_node(
    _: None,
    rows: int,
    columns: int,
    order: OrderEnum,
) -> Collector[np.ndarray, np.ndarray]:
    results = []

    def on_iterate(tile: np.ndarray):
        results.append(tile)

    def on_complete():
        if order == OrderEnum.ROW_MAJOR:
            result_rows = []
            for i in range(rows):
                row = np.concatenate(results[i * columns : (i + 1) * columns], axis=1)
                result_rows.append(row)
            return np.concatenate(result_rows, axis=0)
        elif order == OrderEnum.COLUMN_MAJOR:
            result_cols = []
            for i in range(columns):
                column = np.concatenate(results[i * rows : (i + 1) * rows], axis=0)
                result_cols.append(column)
            return np.concatenate(result_cols, axis=1)
        else:
            raise ValueError(f"Invalid order: {order}")

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
