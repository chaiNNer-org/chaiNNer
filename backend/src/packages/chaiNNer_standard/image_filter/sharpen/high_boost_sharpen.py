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
    name="High Boost Filter",
    description="Apply sharpening to an image using a high boost filter.",
    icon="MdBlurOff",
    inputs=[
        ImageInput(),
        EnumInput(KernelType, label="Filter Type"),
        SliderInput(
            "Amount",
            minimum=0,
            maximum=100,
            default=2,
            precision=1,
            controls_step=1,
            scale="log",
        ),
        BoolInput("Contrast Adaptive", default=False).with_id(3),
        if_enum_group(3, 1)(
            SliderInput(
                "Contrast Adaptive Bias",
                minimum=1,
                maximum=3,
                default=2,
                precision=2,
                controls_step=0.1,
                slider_step=0.1,
            )
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def sharpen_hbf_node(
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
