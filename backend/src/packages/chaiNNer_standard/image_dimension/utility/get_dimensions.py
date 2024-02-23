from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import NumberOutput
from nodes.utils.utils import get_h_w_c

from .. import utility_group


@utility_group.register(
    schema_id="chainner:image:get_dims",
    name="获取尺寸",
    description=("获取图像的高度、宽度和通道数。"),
    icon="BsRulers",
    inputs=[
        ImageInput(),
    ],
    outputs=[
        NumberOutput("宽度", output_type="Input0.width"),
        NumberOutput("高度", output_type="Input0.height"),
        NumberOutput("通道数", output_type="Input0.channels"),
    ],
)
def get_dimensions_node(
    img: np.ndarray,
) -> tuple[int, int, int]:
    h, w, c = get_h_w_c(img)
    return w, h, c
