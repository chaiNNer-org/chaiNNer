from __future__ import annotations

from enum import Enum

import cv2
import numpy as np
import pymatting

import navi
from nodes.groups import if_enum_group, linked_inputs_group
from nodes.impl.color.color import Color
from nodes.properties.inputs import (
    BoolInput,
    ColorInput,
    EnumInput,
    ImageInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from . import node_group


class KeyMethod(Enum):
    BINARY = 1
    TRIMAP_MATTING = 2


@node_group.register(
    schema_id="chainner:image:chroma_key",
    name="色度键",
    description=[
        "从图像中删除颜色并用透明度替换。",
        "要设置关键颜色，请使用 `chainner:utility:color` 节点定义常量颜色，或使用 `chainner:image:pick_color` 节点从图像中选择颜色。",
        "此节点提供多种策略来对图像进行关键处理：",
        "- **二值法**：",
        "  使用简单的二值阈值方法确定图像中的像素是否透明。此方法主要适用于没有抗锯齿的图像。",
        "- **Trimap 抠图**：",
        "  此方法使用前景（FG）和背景（BG）的单独阈值创建 Trimap。然后，在 Trimap 上执行 Alpha 抠图，生成最终的 Alpha 通道。有关 Alpha 抠图的详细信息，请参阅 `chainner:image:alpha_matting` 节点。",
        " 混淆滑块可用于减少被视为前景或背景的像素数量。这对于抗锯齿/模糊边缘很有用。"
        " 由于 Alpha 抠图可能会很慢，因此建议使用 **输出 Trimap** 选项。此选项将直接使用 alpha 的 trimap，而不执行 alpha 抠图。使用快速预览，您可以调整其他参数以生成良好的三维贴图。一旦您对三维贴图感到满意，您可以禁用 **输出三维贴图** 选项来执行 Alpha 抠图。",
    ],
    icon="MdOutlineFormatColorFill",
    inputs=[
        ImageInput(channels=3),
        ColorInput(channels=3),
        EnumInput(KeyMethod).with_id(2),
        if_enum_group(2, KeyMethod.BINARY)(
            SliderInput(
                "Threshold", maximum=100, default=1, precision=1, controls_step=1
            )
        ),
        if_enum_group(2, KeyMethod.TRIMAP_MATTING)(
            SliderInput(
                "Threshold BG", maximum=100, default=2, precision=1, controls_step=1
            ),
            SliderInput(
                "Threshold FG", maximum=100, default=10, precision=1, controls_step=1
            ),
            linked_inputs_group(
                SliderInput("Confusion BG", maximum=100, default=4, scale="log"),
                SliderInput("Confusion FG", maximum=100, default=4, scale="log"),
            ),
            BoolInput("Output Trimap", default=False).with_docs(
                "如果启用，生成的 Trimap 将用作 Alpha。不会执行 alpha 抠图。"
            ),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(size_as="Input0"),
            channels=4,
        ),
    ],
)
def chroma_key_node(
    img: np.ndarray,
    key_color: Color,
    method: KeyMethod,
    binary_threshold: float,
    tm_threshold_bg: float,
    tm_threshold_fg: float,
    tm_confusion_bg: int,
    tm_confusion_fg: int,
    tm_output_trimap: bool,
) -> np.ndarray:
    if method == KeyMethod.BINARY:
        return binary_keying(img, key_color, binary_threshold / 100)
    elif method == KeyMethod.TRIMAP_MATTING:
        return trimap_matting_keying(
            img,
            key_color,
            tm_threshold_bg / 100,
            tm_threshold_fg / 100,
            tm_confusion_bg,
            tm_confusion_fg,
            tm_output_trimap,
        )
    else:
        raise AssertionError(f"Invalid alpha fill method {method}")


def binary_keying(img: np.ndarray, key_color: Color, threshold: float) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    diff = np.abs(img - key_color.to_image(w, h))
    diff = np.sum(diff, axis=-1) / 3

    alpha = np.where(diff > threshold, 1, 0).astype(np.float32)
    return np.dstack([img, alpha])


def trimap_matting_keying(
    img: np.ndarray,
    key_color: Color,
    threshold_bg: float,
    threshold_fg: float,
    confusion_bg: int,
    confusion_fg: int,
    output_trimap: bool,
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    diff = np.abs(img - key_color.to_image(w, h))
    diff = np.sum(diff, axis=-1) / 3

    # determine in and out
    bg_mask = np.where(diff <= threshold_bg, 255, 0).astype(np.uint8)
    fg_mask = np.where(diff > threshold_fg, 255, 0).astype(np.uint8)
    if confusion_bg > 0:
        element = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (2 * confusion_bg + 1,) * 2
        )
        cv2.erode(bg_mask, element, iterations=1, dst=bg_mask)
    if confusion_fg > 0:
        element = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (2 * confusion_fg + 1,) * 2
        )
        cv2.erode(fg_mask, element, iterations=1, dst=fg_mask)

    # must be float64
    trimap = np.full((h, w), 0.5, dtype=np.float64)
    trimap[bg_mask > 128] = 0
    trimap[fg_mask > 128] = 1

    if output_trimap:
        return np.dstack((img, trimap.astype(np.float32)))

    # convert to rgb
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float64)

    assert img.dtype == np.float64
    assert trimap.dtype == np.float64
    alpha = pymatting.estimate_alpha_cf(img, trimap)
    foreground = pymatting.estimate_foreground_ml(img, alpha)
    assert isinstance(foreground, np.ndarray)

    # convert to bgr
    foreground = cv2.cvtColor(foreground, cv2.COLOR_RGB2BGR)
    return np.dstack(
        (
            foreground.astype(np.float32),
            alpha.astype(np.float32),
        )
    )
