from __future__ import annotations

from enum import Enum

import numpy as np

from nodes.groups import if_enum_group
from nodes.impl.color.color import Color
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ColorOutput
from nodes.utils.utils import get_h_w_c, round_half_up

from .. import miscellaneous_group


class CoordinateType(Enum):
    RELATIVE = 1
    ABSOLUTE = 2


@miscellaneous_group.register(
    schema_id="chainner:image:pick_color",
    name="拾取颜色",
    description=[
        "返回给定坐标处像素的颜色。",
        "此节点支持两种坐标类型：",
        "- 相对坐标：坐标相对于图像大小。因此 (X=0, Y=0) 是左上角像素，((X=50%, Y=50%) 是中心像素，(X=100%, Y=100%) 是右下角像素。",
        "- 绝对坐标：坐标是绝对像素坐标。因此 (X=0, Y=0) 是左上角像素，(X=width-1, Y=height-1) 是右下角像素。不允许在图像之外使用 X-Y 坐标，否则将导致错误。",
    ],
    icon="MdColorize",
    inputs=[
        ImageInput(channels=[1, 3, 4]).with_id(0),
        EnumInput(
            CoordinateType, default=CoordinateType.ABSOLUTE, preferred_style="tabs"
        ).with_id(3),
        if_enum_group(3, CoordinateType.RELATIVE)(
            SliderInput(
                "X",
                maximum=100,
                default=0,
                controls_step=1,
                unit="%",
            )
            .with_docs("相对 X 坐标。")
            .with_id(4),
            SliderInput(
                "Y",
                maximum=100,
                default=0,
                controls_step=1,
                unit="%",
            )
            .with_docs("相对 Y 坐标。")
            .with_id(5),
        ),
        if_enum_group(3, CoordinateType.ABSOLUTE)(
            NumberInput(
                "X",
                default=0,
                minimum=0,
                unit="px",
            )
            .with_docs("绝对 X 坐标。")
            .with_id(1),
            NumberInput(
                "Y",
                default=0,
                minimum=0,
                unit="px",
            )
            .with_docs("绝对 Y 坐标。")
            .with_id(2),
        ),
    ],
    outputs=[
        ColorOutput(
            "Color",
            color_type="""
                let image = Input0;
                let coords = Input3;
                let x = Input1;
                let y = Input2;

                let valid = match coords {
                    CoordinateType::Relative => true,
                    CoordinateType::Absolute => bool::and(x < image.width, y < image.height),
                };

                if valid {
                    Color { channels: Input0.channels }
                } else {
                    never
                }
            """,
        ).with_never_reason("The given coordinates (X, Y) are outside the image."),
    ],
)
def pick_color_node(
    orig_img: np.ndarray,
    coord_type: CoordinateType,
    x_rel: int,
    y_rel: int,
    x: int,
    y: int,
) -> Color:
    h, w, c = get_h_w_c(orig_img)

    if coord_type == CoordinateType.RELATIVE:
        x = round_half_up((w - 1) * x_rel / 100)
        y = round_half_up((h - 1) * y_rel / 100)

    assert x < w and y < h, (
        "给定的坐标 (X, Y) 在图像之外。"
        f" Expect X={x} to be to 0 to {w-1} and Y={y} to be to 0 to {h-1}."
    )

    if c == 1:
        return Color.gray(orig_img[y, x])
    elif c == 3:
        return Color.bgr(orig_img[y, x])
    elif c == 4:
        return Color.bgra(orig_img[y, x])
    else:
        raise ValueError(f"通道数量不受支持: {c}")
