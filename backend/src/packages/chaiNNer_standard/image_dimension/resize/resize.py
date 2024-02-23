from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.resize import ResizeFilter, resize
from nodes.properties.inputs import (
    BoolInput,
    EnumInput,
    ImageInput,
    NumberInput,
    ResizeFilterInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c, round_half_up

from .. import resize_group


class ImageResizeMode(Enum):
    PERCENTAGE = 0
    ABSOLUTE = 1


@resize_group.register(
    schema_id="chainner:image:resize",
    name="调整大小",
    description=[
        "按百分比比例因子或绝对尺寸调整图像大小。",
        "Auto使用长方体进行下采样，使用lanczo进行上采样。",
    ],
    icon="MdOutlinePhotoSizeSelectLarge",
    inputs=[
        ImageInput(),
        EnumInput(
            ImageResizeMode, default=ImageResizeMode.PERCENTAGE, preferred_style="tabs"
        ).with_id(1),
        if_enum_group(1, ImageResizeMode.PERCENTAGE)(
            NumberInput(
                "Percentage",
                precision=4,
                controls_step=25.0,
                default=100.0,
                unit="%",
                label_style="hidden",
            ).with_id(2),
        ),
        if_enum_group(1, ImageResizeMode.ABSOLUTE)(
            NumberInput("Width", minimum=1, default=1, unit="px").with_id(3),
            NumberInput("Height", minimum=1, default=1, unit="px").with_id(4),
        ),
        ResizeFilterInput().with_id(5),
        if_group(Condition.type(0, "Image { channels: 4 } "))(
            BoolInput("Separate Alpha", default=False)
            .with_docs(
                "与颜色分开调整 Alpha 大小。如果图像的 Alpha 通道**不是**透明度，请启用此选项。",
                "要正确调整透明度图像的大小，在调整大小之前必须将 Alpha 通道与颜色通道相乘。虽然这会产生正确的颜色值，但它也会将完全透明像素的颜色设置为黑色。如果 Alpha 通道不透明，这就会出现问题。例如。游戏经常将纹理的 Alpha 通道用于其他目的，例如高度图或边缘图。对于此类图像，必须单独调整 Alpha 通道的大小，否则会破坏颜色通道。",
                "对于alpha通道为透明的图像（大多数透明图像），此选项应**禁用**。",
                hint=True,
            )
            .with_id(6)
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let i = Input0;
                let mode = Input1;

                let scale = Input2;
                let width = Input3;
                let height = Input4;

                match mode {
                    ImageResizeMode::Percentage => Image {
                        width: max(1, int & round(i.width * scale / 100)),
                        height: max(1, int & round(i.height * scale / 100)),
                        channels: i.channels,
                    },
                    ImageResizeMode::Absolute => Image {
                        width: width,
                        height: height,
                        channels: i.channels,
                    },
                }
            """,
            assume_normalized=True,
        )
    ],
)
def resize_node(
    img: np.ndarray,
    mode: ImageResizeMode,
    scale: float,
    width: int,
    height: int,
    filter: ResizeFilter,
    separate_alpha: bool,
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    out_dims: tuple[int, int]
    if mode == ImageResizeMode.PERCENTAGE:
        out_dims = (
            max(round_half_up(w * (scale / 100)), 1),
            max(round_half_up(h * (scale / 100)), 1),
        )
    else:
        out_dims = (width, height)

    return resize(
        img,
        out_dims,
        filter,
        separate_alpha=separate_alpha,
        gamma_correction=False,
    )
