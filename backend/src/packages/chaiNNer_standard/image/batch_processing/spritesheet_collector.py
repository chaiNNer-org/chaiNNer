from __future__ import annotations

from typing import Tuple

import numpy as np

from api import Collector
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import batch_processing_group


@batch_processing_group.register(
    schema_id="chainner:image:spritesheet_collector",
    name="Spritesheet Collector",
    description=[
        "Combines an iterable sequence into a single image spritesheet.",
    ],
    icon="MdLoop",
    inputs=[
        ImageInput("Image Sequence"),
        NumberInput(
            "Number of rows (height)",
            controls_step=1,
            minimum=1,
            default=1,
            has_handle=False,
        ).with_docs(
            "The number of rows to split the image into. The height of the image must be a multiple of this number."
        ),
        NumberInput(
            "Number of columns (width)",
            controls_step=1,
            minimum=1,
            default=1,
            has_handle=False,
        ).with_docs(
            "The number of columns to split the image into. The width of the image must be a multiple of this number."
        ),
    ],
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
    node_type="collector",
)
def spritesheet_collector_node(
    _tile: np.ndarray,
    rows: int,
    columns: int,
) -> Collector[Tuple[np.ndarray, int, int], np.ndarray]:
    results = []

    # TODO: This system is pretty messy. We need to separate out the creation
    # of the collector from the actual collection. As-is we have unused inputs
    def on_iterate(inputs: Tuple[np.ndarray, int, int]):
        tile = inputs[0]
        results.append(tile)

    def on_complete():
        result_rows = []
        for i in range(rows):
            row = np.concatenate(results[i * columns : (i + 1) * columns], axis=1)
            result_rows.append(row)
        return np.concatenate(result_rows, axis=0)

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
