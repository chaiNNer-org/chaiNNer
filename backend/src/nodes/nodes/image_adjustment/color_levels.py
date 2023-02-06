from __future__ import annotations

import numpy as np

from . import category as ImageAdjustmentCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput, BoolInput
from ...properties.outputs import ImageOutput
from ...impl.image_utils import as_3d
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:color_levels")
class ColorLevelsNode(NodeBase):
    """
    Color Levels can be used to make an image lighter or darker,
    to change contrast or to correct a predominant color cast.

    This code was adapted from a Stack-Overflow answer by Iperov,
    can found at: https://stackoverflow.com/a/60339950
    """

    def __init__(self):
        super().__init__()
        self.description = "Adjust color levels"
        self.inputs = [
            ImageInput(),
            BoolInput("Red", default=True),
            BoolInput("Green", default=True),
            BoolInput("Blue", default=True),
            BoolInput("Alpha", default=False),
            SliderInput(
                "In Black",
                minimum=0,
                maximum=255,
                default=0,
                precision=1,
                controls_step=1,
            ),
            SliderInput(
                "In White",
                minimum=0,
                maximum=255,
                default=255,
                precision=1,
                controls_step=1,
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
                maximum=255,
                default=0,
                precision=1,
                controls_step=1,
            ),
            SliderInput(
                "Out White",
                minimum=0,
                maximum=255,
                default=255,
                precision=1,
                controls_step=1,
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Color Levels"
        self.icon = "MdOutlineColorLens"
        self.sub = "Adjustments"

    def run(
        self,
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
        """Adjust color levels of image"""

        _, _, c = get_h_w_c(img)
        c = min(c, 4)

        if c == 1:
            img = as_3d(img)
            red, green, blue = True, True, True

        img = (img * 255).astype("uint8")
        in_gamma = max(0.001, in_gamma)

        in_black_all = np.full(c, in_black, dtype="float32")
        in_white_all = np.full(c, in_white, dtype="float32")
        in_gamma_all = np.full(c, in_gamma, dtype="float32")
        out_black_all = np.full(c, out_black, dtype="float32")
        out_white_all = np.full(c, out_white, dtype="float32")

        selected_channels = [blue, green, red, alpha] if c == 4 else [blue, green, red]

        for i, channel in enumerate(selected_channels):
            if not channel:
                in_black_all[i], in_white_all[i], in_gamma_all[i] = 0, 255, 1
                out_black_all[i], out_white_all[i] = 0, 255

        img = np.clip((img - in_black_all) / (in_white_all - in_black_all), 0, 255)
        img = (img ** (1 / in_gamma_all)) * (out_white_all - out_black_all) + out_black_all
        img = np.clip(img, 0, 255).astype("uint8")

        return img.astype("float32") / 255
