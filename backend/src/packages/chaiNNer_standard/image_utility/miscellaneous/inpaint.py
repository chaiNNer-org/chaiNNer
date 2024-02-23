from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

import navi
from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


class InpaintAlgorithm(Enum):
    NS = cv2.INPAINT_NS
    TELEA = cv2.INPAINT_TELEA


@miscellaneous_group.register(
    schema_id="chainner:image:inpaint",
    name="修补",
    description=[
        "使用给定的蒙版对图像进行修补。",
        "蒙版通常需要在chaiNNer之外制作。",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput(channels=[1, 3]),
        ImageInput(label="蒙版", channels=1).with_docs(
            "修复蒙版是一种灰度图像，其中白色表示要修复的部分，黑色表示要保留的部分。",
            "这通常需要在chaiNNer之外制作。",
            hint=True,
        ),
        EnumInput(
            InpaintAlgorithm,
            option_labels={
                InpaintAlgorithm.NS: "Navier Stokes",
                InpaintAlgorithm.TELEA: "Telea",
            },
        ),
        NumberInput(
            "搜索半径",
            minimum=0,
            default=1,
            precision=1,
            controls_step=1,
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="Input0.width & Input1.width",
                height="Input0.height & Input1.height",
                channels="Input0.channels",
            )
        ).with_never_reason("给定的图像和蒙版必须具有相同的分辨率。")
    ],
    limited_to_8bpc=True,
)
def inpaint_node(
    img: np.ndarray,
    mask: np.ndarray,
    inpaint_method: InpaintAlgorithm,
    radius: float,
) -> np.ndarray:
    assert (
        img.shape[:2] == mask.shape[:2]
    ), "输入图像和掩模必须具有相同的分辨率"

    img = to_uint8(img, normalized=True)
    mask = to_uint8(mask, normalized=True)
    return cv2.inpaint(img, mask, radius, inpaint_method.value)
