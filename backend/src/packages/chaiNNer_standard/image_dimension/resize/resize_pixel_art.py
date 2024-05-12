from __future__ import annotations

from enum import Enum

import numpy as np
from chainner_ext import pixel_art_upscale

from nodes.properties.inputs import (
    EnumInput,
    ImageInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import assert_image_dimensions, get_h_w_c

from .. import resize_group


class ResizeAlgorithm(Enum):
    ADV_MANE_2X = "adv_mame2x"
    ADV_MANE_3X = "adv_mame3x"
    ADV_MANE_4X = "adv_mame4x"
    EAGLE_2X = "eagle2x"
    EAGLE_3X = "eagle3x"
    SUPER_EAGLE_2X = "super_eagle2x"
    SAI_2X = "sai2x"
    SUPER_SAI_2X = "super_sai2x"
    HQ2X = "hqx2x"
    HQ3X = "hqx3x"
    HQ4X = "hqx4x"

    @property
    def algorithm(self) -> str:
        return self.value[:-2]

    @property
    def scale(self) -> int:
        if self in (ResizeAlgorithm.ADV_MANE_4X, ResizeAlgorithm.HQ4X):
            return 4
        if self in (
            ResizeAlgorithm.ADV_MANE_3X,
            ResizeAlgorithm.EAGLE_3X,
            ResizeAlgorithm.HQ3X,
        ):
            return 3
        return 2


ALGORITHM_LABEL: dict[ResizeAlgorithm, str] = {
    ResizeAlgorithm.ADV_MANE_2X: "EXP/AdvMAME 2x",
    ResizeAlgorithm.ADV_MANE_3X: "EXP/AdvMAME 3x",
    ResizeAlgorithm.ADV_MANE_4X: "EXP/AdvMAME 4x",
    ResizeAlgorithm.EAGLE_2X: "Eagle 2x",
    ResizeAlgorithm.EAGLE_3X: "Eagle 3x",
    ResizeAlgorithm.SUPER_EAGLE_2X: "Super Eagle 2x",
    ResizeAlgorithm.SAI_2X: "SaI 2x",
    ResizeAlgorithm.SUPER_SAI_2X: "Super SaI 2x",
    ResizeAlgorithm.HQ2X: "HQ 2x",
    ResizeAlgorithm.HQ3X: "HQ 3x",
    ResizeAlgorithm.HQ4X: "HQ 4x",
}


@resize_group.register(
    schema_id="chainner:image:resize_pixel_art",
    name="Resize Pixel Art",
    description=[
        "Upscales pixel art images using a variety of algorithms.",
        "An overview of the algorithms can be found [here](https://en.wikipedia.org/w/index.php?title=Pixel-art_scaling_algorithms&oldid=1181447123).",
    ],
    icon="MdOutlinePhotoSizeSelectLarge",
    inputs=[
        ImageInput(channels=[1, 3, 4]),
        EnumInput(
            ResizeAlgorithm,
            label="Method",
            default=ResizeAlgorithm.HQ2X,
            option_labels=ALGORITHM_LABEL,
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let scale: uint = match Input1 {
                    ResizeAlgorithm::AdvMane2X => 2,
                    ResizeAlgorithm::AdvMane3X => 3,
                    ResizeAlgorithm::AdvMane4X => 4,
                    ResizeAlgorithm::Eagle2X => 2,
                    ResizeAlgorithm::Eagle3X => 3,
                    ResizeAlgorithm::SuperEagle2X => 2,
                    ResizeAlgorithm::Sai2X => 2,
                    ResizeAlgorithm::SuperSai2X => 2,
                    ResizeAlgorithm::Hq2X => 2,
                    ResizeAlgorithm::Hq3X => 3,
                    ResizeAlgorithm::Hq4X => 4,
                };

                Image {
                    width: Input0.width * scale,
                    height: Input0.height * scale,
                    channels: Input0.channels
                }
                """,
        )
    ],
)
def resize_pixel_art_node(
    img: np.ndarray,
    algorithm: ResizeAlgorithm,
) -> np.ndarray:
    h, w, c = get_h_w_c(img)

    assert_image_dimensions((h * algorithm.scale, w * algorithm.scale, c))

    return pixel_art_upscale(img, algorithm.algorithm, algorithm.scale)
