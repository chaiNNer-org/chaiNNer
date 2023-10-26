from __future__ import annotations

import numpy as np
from nodes.impl.color.color import Color
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ColorOutput
from nodes.utils.utils import get_h_w_c

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:pick_color",
    name="Pick Color",
    description=(
        "Returns the color of the pixel at the given coordinates."
        "The coordinates are zero-based and start at the top-left corner of the image. So (X=0, Y=0) is the top-left pixel. Coordinates outside the image are not allowed. So X must be at most `width-1` and Y must be at most `height-1` (where `width` and `height` are the dimensions of the input image)."
    ),
    icon="MdColorize",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        NumberInput("X", default=0, minimum=0, unit="px"),
        NumberInput("Y", default=0, minimum=0, unit="px"),
    ],
    outputs=[
        ColorOutput(
            "Color",
            color_type="""
                let image = Input0;
                let x = Input1;
                let y = Input2;

                let valid = if bool::and(x < image.width, y < image.height) { any } else { never };
                valid & Color { channels: Input0.channels }
            """,
        ).with_never_reason("The given coordinates (X, Y) are outside the image."),
    ],
)
def pick_color_node(orig_img: np.ndarray, x: int, y: int) -> Color:
    h, w, c = get_h_w_c(orig_img)
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
