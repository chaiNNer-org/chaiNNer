from __future__ import annotations

import cv2
import numpy as np
import pymatting

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from . import node_group


@node_group.register(
    schema_id="chainner:image:alpha_matting",
    name="Alpha抠图",
    description=[
        "使用 Trimap 将前景与背景分开。",
        "Trimap 是一种三色图像，将输入图像分类为前景（白色）、背景（黑色）和未决定（灰色）。 Alpha matting 使用此信息将前景与背景分开。",
        "trimap通常必须手动创建，但这通常是一项简单的任务，因为trimap不必详细说明。唯一的要求是黑色像素是背景，白色像素是前景。前景和背景之间的边界区域可以是灰色的。",
        "下图显示了输入图像（左上）、三分图（右上）、输出alpha（左下）和具有不同背景的输出图像（右下）："
        "![lemur_at_the_beach.png](https://github.com/pymatting/pymatting/raw/master/data/lemur/lemur_at_the_beach.png)",
    ],
    icon="MdContentCut",
    see_also="chainner:onnx:rembg",
    inputs=[
        ImageInput(channels=[3, 4]).with_docs(
            "如果图像有 Alpha 通道，它将被忽略。"
        ),
        ImageInput("Trimap", channels=1),
        SliderInput(
            "前景阈值", minimum=1, maximum=255, default=240
        ).with_docs(
            "Trimap 中比该值更亮的所有像素都被视为前景的一部分。"
        ),
        SliderInput(
            "背景阈值", minimum=0, maximum=254, default=15
        ).with_docs(
            "Trimap 中比该值暗的所有像素都被视为背景的一部分。"
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let image = Input0;
                let trimap = Input1;
                let fg = Input2;
                let bg = Input3;

                if fg <= bg {
                    error("The foreground threshold must be greater than the background threshold.")
                } else if bool::or(image.width != trimap.width, image.height != trimap.height) {
                    error("图像和trimap必须具有相同的大小。")
                } else {
                    Image { width: image.width, height: image.height }
                }
            """,
            channels=4,
        ),
    ],
)
def alpha_matting_node(
    img: np.ndarray,
    trimap: np.ndarray,
    fg_threshold: int,
    bg_threshold: int,
) -> np.ndarray:
    assert (
        fg_threshold > bg_threshold
    ), "前景阈值必须大于背景阈值。"

    h, w, c = get_h_w_c(img)
    assert (h, w) == trimap.shape[:2], "图像和修剪图必须具有相同的大小。"

    # apply thresholding to trimap
    trimap = np.where(trimap > fg_threshold / 255, 1, trimap)
    trimap = np.where(trimap < bg_threshold / 255, 0, trimap)
    trimap = trimap.astype(np.float64)

    # convert to rgb
    if c == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
    else:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float64)

    assert img.dtype == np.float64
    assert trimap.dtype == np.float64
    alpha = pymatting.estimate_alpha_cf(img, trimap)
    foreground = pymatting.estimate_foreground_ml(img, alpha)
    assert isinstance(foreground, np.ndarray)

    # convert to bgr
    foreground = cv2.cvtColor(foreground, cv2.COLOR_RGB2BGR)
    return np.dstack((foreground, alpha))
