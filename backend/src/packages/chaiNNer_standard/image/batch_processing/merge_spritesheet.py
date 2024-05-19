from __future__ import annotations

from enum import Enum

import numpy as np

from api import Collector, IteratorInputInfo
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import batch_processing_group


class OrderEnum(Enum):
    ROW_X_COLUMN = 0
    COLUMN_X_ROW = 1


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
        EnumInput(OrderEnum, label="Order", default=OrderEnum.ROW_X_COLUMN).with_docs(
            "The order in which the images are combined."
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
        if order == OrderEnum.ROW_X_COLUMN:
            result_rows = []
            for i in range(rows):
                row = np.concatenate(results[i * columns : (i + 1) * columns], axis=1)
                result_rows.append(row)
            return np.concatenate(result_rows, axis=0)
        elif order == OrderEnum.COLUMN_X_ROW:
            result_cols = []
            for i in range(columns):
                column = np.concatenate(results[i * rows : (i + 1) * rows], axis=0)
                result_cols.append(column)
            return np.concatenate(result_cols, axis=1)
        else:
            raise ValueError(f"Invalid order: {order}")

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
