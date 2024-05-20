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
    see_also="chainner:image:sharpen",
    icon="MdBlurOff",
    inputs=[
        ImageInput(),
        EnumInput(KernelType, label="Filter Type"),
        SliderInput(
            "Amount",
            min=0,
            max=100,
            default=2,
            precision=1,
            step=1,
            scale="log",
        ),
        BoolInput("Contrast Adaptive", default=False)
        .with_id(3)
        .with_docs(
            "Enable contrast adaptive sharpening.",
            "This will sharpen the image more evenly and prevents over-sharpening in dark areas and areas that are already quite sharp.",
        ),
        if_enum_group(3, 1)(
            SliderInput(
                "Contrast Bias",
                min=1,
                max=3,
                default=2,
                precision=2,
                step=0.1,
                slider_step=0.1,
            ).with_docs(
                "A bias that controls the strength of the contrast adaptiveness. A bias of 2 is recommended, because it offers a good trade-off between sharpening and contrast adaptiveness.",
                "A high bias will result in more sharpening but lose contrast adaptiveness. The bias is bounded between 1 and 3 because values higher than 3 effectively disable the contrast adaptiveness. A bias less than 2 will result in noticeable less sharpening, but apply that sharpening very evenly.",
            )
        ),
    ],
    outputs=[ImageOutput(shape_as=0)],
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
