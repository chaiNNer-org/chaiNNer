from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import optional_list_group
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import ALPHABET, get_h_w_c

from .. import compositing_group


class Expression(Enum):
    MEDIAN = "median"
    MEAN = "mean"
    MIN = "minimum"
    MAX = "maximum"


@compositing_group.register(
    schema_id="chainner:image:z_stack",
    name="Z-堆叠图像",
    description="""对齐多个图像并相对于彼此评估，以创建合并的图像结果。""",
    icon="BsLayersHalf",
    inputs=[
        EnumInput(Expression),
        ImageInput("图像 A"),
        ImageInput("图像 B"),
        optional_list_group(
            *[
                ImageInput(f"图像 {letter}").make_optional()
                for letter in ALPHABET[2:14]
            ],
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def conv(i: Image | null) = match i { Image => i, _ => any };

                Input1 & Input2
                    & conv(Input3)
                    & conv(Input4)
                    & conv(Input5)
                    & conv(Input6)
                    & conv(Input7)
                    & conv(Input8)
                    & conv(Input9)
                    & conv(Input10)
                    & conv(Input11)
                    & conv(Input12)
                    & conv(Input13)
                    & conv(Input14)
            """
        ).with_never_reason(
            "所有输入图像都具有相同的大小和通道数。"
        ),
    ],
)
def z_stack_images_node(
    expression: Expression,
    *inputs: np.ndarray | None,
) -> np.ndarray:
    images = [x for x in inputs if x is not None]
    assert (
        2 <= len(images) <= 15
    ), f"图片数量必须在 2 到 15 之间 ({len(images)})"

    assert all(
        get_h_w_c(image) == get_h_w_c(images[0]) for image in images
    ), "所有图像必须具有相同的尺寸和通道"

    if expression == Expression.MEAN:
        result = np.mean(images, axis=0)
    elif expression == Expression.MEDIAN:
        result = np.median(images, axis=0)
    elif expression == Expression.MIN:
        result = np.min(images, axis=0)
    elif expression == Expression.MAX:
        result = np.max(images, axis=0)
    else:
        raise AssertionError(f"Invalid expression '{expression}'")

    return result
