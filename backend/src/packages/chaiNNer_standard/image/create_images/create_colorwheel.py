from __future__ import annotations

import cv2
import numpy as np

import navi
from nodes.impl.gradients import (
    conic_gradient,
)
from nodes.properties.inputs import (
    NumberInput,
)
from nodes.properties.outputs import ImageOutput

from .. import create_images_group


@create_images_group.register(
    schema_id="chainner:image:create_colorwheel",
    name="创建彩色圆盘",
    description="创建带有彩色圆盘的图像。",
    icon="MdLens",
    inputs=[
        NumberInput("大小", minimum=1, unit="px", default=512),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(  # 从头开始创建一个正方形输出缓冲区，并将其设置为由前面定义的 (Number)Input0 宽度和高度
                width="Input0",
                height="Input0",
            ),
            channels=3,
        )
    ],
)
def create_colorwheel_node(
    size: int,
) -> np.ndarray:
    img = np.zeros((size, size), dtype=np.float32)  # Create a new buffer with all zeros

    conic_gradient(
        img, rotation=0 * np.pi / 180
    )  # Create our hue component with a chaiNNer conic gradient

    w = np.ones(
        (size, size), dtype=np.float32
    )  # Create a new buffer with a value of "one"

    hsv = np.stack((img, w, w), axis=2)  # Stack our HSV channels to BGR order

    hsv[:, :, 0] *= 360  # Rotate the channel order

    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
