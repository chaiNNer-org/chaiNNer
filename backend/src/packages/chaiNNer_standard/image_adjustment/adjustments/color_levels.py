from __future__ import annotations

import numpy as np
from nodes.impl.image_utils import as_3d
from nodes.properties.inputs import BoolInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:color_levels",
    name="Color Levels",
    description="Adjust color levels",
    icon="MdOutlineColorLens",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        BoolInput("Red", default=True),
        BoolInput("Green", default=True),
        BoolInput("Blue", default=True),
        BoolInput("Alpha", default=False),
        SliderInput(
            "In Black",
            minimum=0,
            maximum=1,
            default=0,
            precision=3,
            controls_step=0.01,
        ),
        SliderInput(
            "In White",
            minimum=0,
            maximum=1,
            default=1,
            precision=3,
            controls_step=0.01,
        ),
        SliderInput(
            "Gamma",
            minimum=0,
            maximum=10,
            default=1,
            precision=3,
            controls_step=0.01,
            scale="log",
        ),
        SliderInput(
            "Out Black",
            minimum=0,
            maximum=1,
            default=0,
            precision=3,
            controls_step=0.01,
        ),
        SliderInput(
            "Out White",
            minimum=0,
            maximum=1,
            default=1,
            precision=3,
            controls_step=0.01,
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def color_levels_node(
    img: np.ndarray,
    red: bool,
    green: bool,
    blue: bool,
    alpha: bool,
    in_black: float,
    in_white: float,
    in_gamma: float,
    out_black: float,
    out_white: float,
) -> np.ndarray:
    """
    Color Levels can be used to make an image lighter or darker,
    to change contrast or to correct a predominant color cast.

    This code was adapted from a Stack-Overflow answer by Iperov,
    can found at: https://stackoverflow.com/a/60339950
    """
    _, _, c = get_h_w_c(img)

    if c == 1:
        img = as_3d(img)
        red, green, blue = True, True, True

    in_gamma = max(0.001, in_gamma)

    in_black_all = np.full(c, in_black, dtype="float32")
    in_white_all = np.full(c, in_white, dtype="float32")
    in_gamma_all = np.full(c, in_gamma, dtype="float32")
    out_black_all = np.full(c, out_black, dtype="float32")
    out_white_all = np.full(c, out_white, dtype="float32")

    selected_channels = [blue, green, red, alpha] if c == 4 else [blue, green, red]

    for i, channel in enumerate(selected_channels):
        if not channel:
            in_black_all[i], in_white_all[i], in_gamma_all[i] = 0, 1, 1
            out_black_all[i], out_white_all[i] = 0, 1

    img = (img - in_black_all) / (in_white_all - in_black_all)
    img = np.clip(img, 0, 1)
    img = (img ** (1 / in_gamma_all)) * (out_white_all - out_black_all) + out_black_all

    return img
