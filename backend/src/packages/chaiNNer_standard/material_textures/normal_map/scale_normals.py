from __future__ import annotations

import numpy as np

import navi
from nodes.impl.normals.addition import AdditionMethod, strengthen_normals
from nodes.impl.normals.util import xyz_to_bgr
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import normal_map_group


    @normal_map_group.register(
    schema_id="chainner:image:strengthen_normals",
    name="加强法线",
    description=[
        "加强或减弱给定法线图中的法线。仅使用输入图像的R和G通道。输出法线图保证被归一化。",
        "从概念上讲，该节点等效于将第二个法线图的强度设置为0的`chainner:image:add_normals`。",
    ],
    icon="MdExpand",
    inputs=[
        ImageInput("法线图", channels=[3, 4]),
        SliderInput("强度", maximum=400, default=100),
        EnumInput(
            AdditionMethod,
            label="方法",
            default=AdditionMethod.PARTIAL_DERIVATIVES,
        ),
    ],
    outputs=[
        ImageOutput(
            "法线图",
            image_type=navi.Image(size_as="Input0"),
            channels=3,
        ),
    ],

def scale_normals_node(
    n: np.ndarray, strength: int, method: AdditionMethod
) -> np.ndarray:
    return xyz_to_bgr(strengthen_normals(method, n, strength / 100))
