from __future__ import annotations

import numpy as np

import navi
from nodes.impl.normals.addition import AdditionMethod, add_normals
from nodes.impl.normals.util import xyz_to_bgr
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import normal_map_group


@normal_map_group.register(
    schema_id="chainner:image:add_normals",
    name="添加法线",
    description="""将两个法线图相加。仅使用输入图像的R和G通道。输出法线图保证已归一化。""",
    icon="MdAddCircleOutline",
    inputs=[
        ImageInput("法线图1", channels=[3, 4]),
        SliderInput("强度1", maximum=200, default=100),
        ImageInput("法线图2", channels=[3, 4]),
        SliderInput("强度2", maximum=200, default=100),
        EnumInput(
            AdditionMethod,
            label="方法",
            default=AdditionMethod.PARTIAL_DERIVATIVES,
        ),
    ],
    outputs=[
        ImageOutput(
            "法线图",
            image_type=navi.Image(
                width="Input0.width & Input2.width",
                height="Input0.height & Input2.height",
            ),
            channels=3,
        ).with_never_reason(
            "给定的法线图大小不同，但必须相同大小。"
        ),
    ],
)
def add_normals_node(
    n1: np.ndarray,
    strength1: int,
    n2: np.ndarray,
    strength2: int,
    method: AdditionMethod,
) -> np.ndarray:
    return xyz_to_bgr(
        add_normals(
            method,
            n1,
            n2,
            f1=strength1 / 100,
            f2=strength2 / 100,
        )
    )
