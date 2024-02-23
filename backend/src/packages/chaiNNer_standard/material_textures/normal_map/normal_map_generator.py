from __future__ import annotations

import math
from enum import Enum

import cv2
import numpy as np

import navi
from nodes.groups import icon_set_group, if_enum_group
from nodes.impl.image_utils import BorderType, create_border, fast_gaussian_blur
from nodes.impl.normals.edge_filter import EdgeFilter, get_filter_kernels
from nodes.impl.normals.height import HeightSource, get_height_map
from nodes.properties.inputs import (
    BoolInput,
    EnumInput,
    ImageInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import Padding, get_h_w_c

from .. import normal_map_group


class AlphaOutput(Enum):
    NONE = "none"
    UNCHANGED = "unchanged"
    HEIGHT = "height"
    ONE = "one"


def as_grayscale(img: np.ndarray) -> np.ndarray:
    c = get_h_w_c(img)[2]
    if c == 1:
        return img
    if c == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    raise AssertionError("仅支持灰度和 RGB 图像。")


def normalize(x: np.ndarray, y: np.ndarray):
    h, w, _ = get_h_w_c(x)
    # No idea why, but that's the value NvTT uses
    z = 2
    l = np.sqrt(np.square(x) + np.square(y) + z * z)
    return x / l, y / l, np.ones((h, w), dtype=np.float32) * z / l


@normal_map_group.register(
    schema_id="chainner:image:normal_generator",
    name="法线图生成器",
    description=[
        "使用指定的过滤技术从给定图像生成法线图。",
        "节点首先将给定图像转换为高度图。然后对高度图应用滤波器以计算法线图。",
        "### 高度图生成",
        "由于此节点需要高度图，因此它将始终将输入图像转换为高度图。**高度**输入确定此转换如何进行。",
        "通常，如果您已经有一个用于纹理的良好高度图，请使用 *平均RGB* 以获得最佳结果。",
        "如果您有反照率/漫反射纹理，则大多数高度来源将使用像素亮度近似高度图。这是一个非常粗略的近似，但可能足够好用。在使用其他高度来源之前，请尝试 *平均RGB* 并测试不同的滤波器。",
        "### 滤波器",
        "有许多可用的滤波器。通常，*Sobel（dUdV）（3x3）* 滤波器是获得法线图的不错选择。由于滤波器尺寸小且不太激进，因此即使在粗略的高度图上（例如从反照率/漫反射纹理获得的高度图），它也能很好地工作。对于更激进的滤波器，请尝试 *Scharr（3x3）* 或 *4样本（1x3）*。",
        "如果您想对输出法线图进行更精细的控制，请使用 *多高斯* 滤波器。该滤波器对多个频率进行操作，并允许您控制每个频率的强度。这使您可以调整微小细节和大特征的影响。*比例 1** 是最小细节的强度，而 **比例 8** 是最大特征的强度。",
        "注意：如果将 **比例 1** 设置为 1，将所有其他比例设置为 0，您将获得与 *4样本（1x3）* 滤波器几乎相同的结果。如果将 **比例 2** 设置为 1，将所有其他比例设置为 0，您将获得与 *Sobel（dUdV）（3x3）* 滤波器几乎相同的结果。",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput("图像", channels=[1, 3, 4]),
        BoolInput("可平铺", default=False)
        .with_docs(
            "如果启用，将视输入纹理为可平铺，并创建可平铺的法线图。",
            hint=True,
        )
        .with_id(16),
        EnumInput(
            HeightSource,
            label="高度",
            label_style="inline",
            default=HeightSource.AVERAGE_RGB,
        )
        .with_docs(
            "给定输入图像的R、G、B、A通道，将计算高度图如下：",
            "- 平均RGB: `高度 = (R + G + B) / 3`",
            "- 最大RGB: `高度 = max(R, G, B)`",
            "- 屏幕RGB: `高度 = 1 - ((1 - R) * (1 - G) * (1 - B))`",
            "- 红色: `高度 = R`",
            "- 绿色: `高度 = G`",
            "- 蓝色: `高度 = B`",
            "- Alpha: `高度 = A`",
        )
        .with_id(1),
        SliderInput(
            "模糊/锐化",
            minimum=-20,
            maximum=20,
            default=0,
            precision=1,
        )
        .with_docs(
            "快速模糊或锐化高度图的方法。负值会模糊，正值会锐化。"
        )
        .with_id(2),
        SliderInput(
            "最小 Z",
            minimum=0,
            maximum=1,
            default=0,
            precision=3,
            slider_step=0.01,
            controls_step=0.05,
        )
        .with_docs(
            "A minimum height that can be used to cut off low height values.",
            "This value is generally only useful in specific circumstances, so it's usually best to leave it at 0.",
        )
        .with_id(3),
        SliderInput(
            "Scale",
            minimum=0,
            maximum=100,
            default=1,
            precision=3,
            controls_step=0.1,
            scale="log-offset",
        )
        .with_docs(
            "A factor applied to the height map.",
            "The smaller the scale, the most flat the output normal map will be. The large the scale, the more pronounced the normal map will be.",
        )
        .with_id(4),
        EnumInput(
            EdgeFilter,
            label="Filter",
            label_style="inline",
            default=EdgeFilter.SOBEL,
            option_labels={
                EdgeFilter.SOBEL: "Sobel (dUdV) (3x3)",
                EdgeFilter.SOBEL_LIKE_5: "Sobel-like (5x5)",
                EdgeFilter.SOBEL_LIKE_7: "Sobel-like (7x7)",
                EdgeFilter.SOBEL_LIKE_9: "Sobel-like (9x9)",
                EdgeFilter.PREWITT: "Prewitt (3x3)",
                EdgeFilter.SCHARR: "Scharr (3x3)",
                EdgeFilter.FOUR_SAMPLE: "4 Sample (1x3)",
                EdgeFilter.MULTI_GAUSS: "Multi Gaussian",
            },
        ).with_id(5),
        if_enum_group(5, EdgeFilter.MULTI_GAUSS)(
            SliderInput(
                "Scale 1",
                minimum=0,
                maximum=10,
                default=0.25,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(8),
            SliderInput(
                "Scale 2",
                minimum=0,
                maximum=10,
                default=0.5,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(9),
            SliderInput(
                "Scale 3",
                minimum=0,
                maximum=10,
                default=0.3,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(10),
            SliderInput(
                "Scale 4",
                minimum=0,
                maximum=10,
                default=0.25,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(11),
            SliderInput(
                "Scale 5",
                minimum=0,
                maximum=10,
                default=0.2,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(12),
            SliderInput(
                "Scale 6",
                minimum=0,
                maximum=10,
                default=0.15,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(13),
            SliderInput(
                "Scale 7",
                minimum=0,
                maximum=10,
                default=0.10,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(14),
            SliderInput(
                "Scale 8",
                minimum=0,
                maximum=10,
                default=0.10,
                precision=3,
                controls_step=0.1,
                scale="log-offset",
                has_handle=False,
            ).with_id(15),
        ),
        icon_set_group("Invert")(
            BoolInput("Invert R", default=False, icon="R")
            .with_docs("Whether to invert the R/X channels of the normal map.")
            .with_id(17),
            BoolInput("Invert G", default=False, icon="G")
            .with_docs("Whether to invert the G/Y channels of the normal map.")
            .with_id(18),
        ),
        EnumInput(
            AlphaOutput,
            label="Alpha",
            label_style="inline",
            default=AlphaOutput.NONE,
            option_labels={AlphaOutput.ONE: "Set to 1"},
        )
        .with_docs("Determines the alpha channel of the generated normal map.")
        .with_id(7),
    ],
    outputs=[
        ImageOutput(
            "Normal Map",
            image_type=navi.Image(
                size_as="Input0",
                channels="match Input7 { AlphaOutput::None => 3, _ => 4 }",
            ),
        ),
    ],
)
def normal_map_generator_node(
    img: np.ndarray,
    tileable: bool,
    height_source: HeightSource,
    blur_sharp: float,
    min_z: float,
    scale: float,
    edge_filter: EdgeFilter,
    gauss_scale1: float,
    gauss_scale2: float,
    gauss_scale3: float,
    gauss_scale4: float,
    gauss_scale5: float,
    gauss_scale6: float,
    gauss_scale7: float,
    gauss_scale8: float,
    invert_r: bool,
    invert_g: bool,
    alpha_output: AlphaOutput,
) -> np.ndarray:
    h, w, c = get_h_w_c(img)
    height = get_height_map(img, height_source)

    filter_x, filter_y = get_filter_kernels(
        edge_filter,
        gauss_parameter=[
            (1 / 4, gauss_scale1),
            (2 / 4, gauss_scale2),
            (4 / 4, gauss_scale3),
            (8 / 4, gauss_scale4),
            (16 / 4, gauss_scale5),
            (32 / 4, gauss_scale6),
            (64 / 4, gauss_scale7),
            (128 / 4, gauss_scale8),
        ],
    )

    padding = 0
    if tileable:
        padding = max(1, filter_x.shape[0] // 2, math.ceil(abs(blur_sharp) * 2))
        height = create_border(height, BorderType.WRAP, Padding.all(padding))

    if blur_sharp < 0:
        # blur
        height = fast_gaussian_blur(height, -blur_sharp)
    elif blur_sharp > 0:
        # sharpen
        blurred = fast_gaussian_blur(height, blur_sharp)
        height = cv2.addWeighted(height, 2.0, blurred, -1.0, 0)

    if min_z > 0:
        height = np.maximum(min_z, height)
    if scale != 0:
        height = height * scale  # type: ignore

    dx = cv2.filter2D(height, -1, filter_x)
    dy = cv2.filter2D(height, -1, filter_y)

    if padding > 0:
        dx = dx[padding:-padding, padding:-padding]
        dy = dy[padding:-padding, padding:-padding]
        height = height[padding:-padding, padding:-padding]

    x, y, z = normalize(dx, dy)

    if invert_r:
        x = -x
    if invert_g:
        y = -y

    if alpha_output is AlphaOutput.NONE:
        a = None
    elif alpha_output is AlphaOutput.HEIGHT:
        a = height
    elif alpha_output is AlphaOutput.UNCHANGED:
        a = np.ones((h, w), dtype=np.float32) if c < 4 else img[:, :, 3]
    elif alpha_output is AlphaOutput.ONE:
        a = np.ones((h, w), dtype=np.float32)
    else:
        raise AssertionError(f"Invalid alpha output '{alpha_output}'")

    r = (x + 1) * 0.5
    g = (y + 1) * 0.5
    b = np.abs(z)

    channels = (b, g, r) if a is None else (b, g, r, a)

    return cv2.merge(channels)
