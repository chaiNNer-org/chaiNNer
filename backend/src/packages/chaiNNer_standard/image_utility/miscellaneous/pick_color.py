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
    name="Pick Color",
    description=[
        "Returns the color of the pixel at the given coordinate.",
        "This node supports 2 coordinate types:",
        "- Relative: The coordinates are relative to the image size. So (X=0, Y=0) is the top-left pixel, ((X=50%, Y=50%) is the center pixel, and (X=100%, Y=100%) is the bottom-right pixel.",
        "- Absolute: The coordinates are absolute pixel coordinates. So (X=0, Y=0) is the top-left pixel and (X=width-1, Y=height-1) is the bottom-right pixel. X-Y coordinates outside the image are not allowed and will result in an error.",
    ],
    icon="MdColorize",
    inputs=[
        ImageInput(channels=[1, 3, 4]).with_id(0),
        EnumInput(
            CoordinateType, default=CoordinateType.ABSOLUTE, preferred_style="tabs"
        ).with_id(3),
        if_enum_group(3, CoordinateType.RELATIVE)(
            SliderInput("X", max=100, default=0, unit="%")
            .with_docs("Relative X coordinate.")
            .with_id(4),
            SliderInput("Y", max=100, default=0, unit="%")
            .with_docs("Relative Y coordinate.")
            .with_id(5),
        ),
        if_enum_group(3, CoordinateType.ABSOLUTE)(
            NumberInput("X", default=0, min=0, unit="px")
            .with_docs("Absolute X coordinate.")
            .with_id(1),
            NumberInput("Y", default=0, min=0, unit="px")
            .with_docs("Absolute Y coordinate.")
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
                    CoordinateType::Absolute => x < image.width and y < image.height,
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
        "The given coordinates (X, Y) are outside the image."
        f" Expect X={x} to be to 0 to {w-1} and Y={y} to be to 0 to {h-1}."
    )

    if c == 1:
        return Color.gray(orig_img[y, x])
    elif c == 3:
        return Color.bgr(orig_img[y, x])
    elif c == 4:
        return Color.bgra(orig_img[y, x])
    else:
        raise ValueError(f"Unsupported number of channels: {c}")
