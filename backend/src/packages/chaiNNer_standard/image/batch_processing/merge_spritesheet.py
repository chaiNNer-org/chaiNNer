from __future__ import annotations

import numpy as np

from api import Collector, IteratorInputInfo
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import batch_processing_group


@batch_processing_group.register(
    schema_id="chainner:image:merge_spritesheet",
    name="合并精灵表",
    description=[
        "将可迭代序列合并成单个图像精灵表。",
    ],
    icon="BsGrid3X3",
    inputs=[
        ImageInput("图像序列"),
        NumberInput(
            "行数（高度）",
            controls_step=1,
            minimum=1,
            default=1,
        ).with_docs(
            "要将图像分割成的行数。图像的高度必须是此数字的倍数。"
        ),
        NumberInput(
            "列数（宽度）",
            controls_step=1,
            minimum=1,
            default=1,
        ).with_docs(
            "要将图像分割成的列数。图像的宽度必须是此数字的倍数。"
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
) -> Collector[np.ndarray, np.ndarray]:
    results = []

    def on_iterate(tile: np.ndarray):
        results.append(tile)

    def on_complete():
        result_rows = []
        for i in range(rows):
            row = np.concatenate(results[i * columns : (i + 1) * columns], axis=1)
            result_rows.append(row)
        return np.concatenate(result_rows, axis=0)

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
