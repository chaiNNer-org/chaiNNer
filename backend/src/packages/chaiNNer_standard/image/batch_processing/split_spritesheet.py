from __future__ import annotations

import numpy as np

from api import Iterator, IteratorOutputInfo
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput, NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import batch_processing_group


@batch_processing_group.register(
    schema_id="chainner:image:split_spritesheet",
    name="分割精灵表",
    description=[
        "迭代单个图像精灵表中的子图像。",
        "此迭代器将图像拆分为一个可迭代的切片序列。",
    ],
    icon="BsFillGrid3X3GapFill",
    inputs=[
        ImageInput("精灵表"),
        NumberInput(
            "行数（高度）",
            controls_step=1,
            minimum=1,
            default=1,
        ).with_docs(
            "要将图像拆分为的行数。图像的高度必须是此数字的倍数。"
        ),
        NumberInput(
            "列数（宽度）",
            controls_step=1,
            minimum=1,
            default=1,
        ).with_docs(
            "要将图像拆分为的列数。图像的宽度必须是此数字的倍数。"
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
        NumberOutput("索引", output_type="min(uint, Input1 * Input2 - 1)").with_docs(
            "从0开始递增，为每个图像分配一个索引的计数器。"
        ),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 1], length_type="Input1 * Input2"),
    kind="newIterator",
)
def split_spritesheet_node(
    sprite_sheet: np.ndarray,
    rows: int,
    columns: int,
) -> Iterator[tuple[np.ndarray, int]]:
    h, w, _ = get_h_w_c(sprite_sheet)
    assert (
        h % rows == 0
    ), "精灵表的高度必须是行数的倍数"
    assert (
        w % columns == 0
    ), "精灵表的宽度必须是列数的倍数"

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

    # 只需要索引，因此我们可以传入一个值全为 None 的列表
    return Iterator.from_range(rows * columns, get_sprite)
