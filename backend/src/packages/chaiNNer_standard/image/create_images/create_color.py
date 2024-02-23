from __future__ import annotations

import numpy as np

import navi
from nodes.impl.color.color import Color
from nodes.properties.inputs import ColorInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import create_images_group


@create_images_group.register(
    schema_id="chainner:image:create_color",
    name="创建颜色",
    description="创建一个指定尺寸、填充指定颜色的图像。",
    icon="MdFormatColorFill",
    inputs=[
        ColorInput("颜色"),
        NumberInput("宽度", minimum=1, unit="px", default=1),
        NumberInput("高度", minimum=1, unit="px", default=1),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="Input1",
                height="Input2",
                channels="Input0.channels",
            ),
            assume_normalized=True,
        )
    ],
)
def create_color_node(color: Color, width: int, height: int) -> np.ndarray:
    return color.to_image(width, height)
