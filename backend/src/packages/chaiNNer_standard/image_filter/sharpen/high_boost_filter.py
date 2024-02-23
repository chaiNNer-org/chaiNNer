from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

from nodes.groups import if_enum_group
from nodes.impl.cas import cas_mix
from nodes.properties.inputs import BoolInput, EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import sharpen_group


class KernelType(Enum):
    NORMAL = 0
    STRONG = 1


@sharpen_group.register(
    schema_id="chainner:image:sharpen_hbf",
    name="高升压滤波器",
    description="使用高提升滤波器对图像进行锐化。",
    see_also="chainner:image:sharpen",
    icon="MdBlurOff",
    inputs=[
        ImageInput(),
        EnumInput(KernelType, label="滤波器类型"),
        SliderInput(
            "Amount",
            minimum=0,
            maximum=100,
            default=2,
            precision=1,
            controls_step=1,
            scale="log",
        ),
        BoolInput("对比度自适应", default=False)
        .with_id(3)
        .with_docs(
            "启用对比度自适应锐化。",
            "这将使图像的锐化更均匀，防止在暗区域和已经相当锐利的区域过度锐化。",
        ),
        if_enum_group(3, 1)(
            SliderInput(
                "对比度偏差",
                minimum=1,
                maximum=3,
                default=2,
                precision=2,
                controls_step=0.1,
                slider_step=0.1,
            ).with_docs(
                "一个控制对比度自适应强度的偏差。推荐使用偏差为2，因为它在锐化和对比度自适应之间取得了良好的平衡。",
                "较高的偏差将导致更多的锐化但失去对比度自适应性。偏差限制在1和3之间，因为高于3的值实际上会禁用对比度自适应性。偏差小于2将导致明显减少的锐化，但会均匀应用该锐化。",
            )
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def high_boost_filter_node(
    img: np.ndarray,
    kernel_type: KernelType,
    amount: float,
    contrast_adaptive: bool,
    bias: float,
) -> np.ndarray:
    if amount == 0:
        return img

    identity = np.array([[0, 0, 0], [0, 1, 0], [0, 0, 0]])
    if kernel_type == KernelType.STRONG:
        # 8-neighbor kernel
        kernel = identity - np.array([[1, 1, 1], [1, 1, 1], [1, 1, 1]]) / 9
    else:
        # 4-neighbor kernel
        kernel = identity - np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]]) / 5

    kernel = kernel * amount + identity
    sharpened = cv2.filter2D(img, -1, kernel)

    if contrast_adaptive:
        shape = cv2.MORPH_RECT if kernel_type == KernelType.STRONG else cv2.MORPH_CROSS
        kernel = cv2.getStructuringElement(shape, (3, 3))
        sharpened = cas_mix(img, sharpened, kernel, bias)

    return sharpened
