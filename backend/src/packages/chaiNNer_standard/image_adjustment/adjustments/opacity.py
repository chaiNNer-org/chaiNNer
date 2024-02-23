from __future__ import annotations

import numpy as np

import navi
from nodes.impl.pil_utils import convert_to_bgra
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:opacity",
    name="不透明度",
    description="调整图像的不透明度。不透明度值越高，图像就越不透明。",
    icon="MdOutlineOpacity",
    inputs=[
        ImageInput(),
        SliderInput(
            "不透明度",
            maximum=100,
            default=100,
            precision=1,
            controls_step=1,
            unit="%",
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(size_as="Input0"),
            channels=4,
            assume_normalized=True,
        )
    ],
)
def opacity_node(img: np.ndarray, opacity: float) -> np.ndarray:
    # Convert inputs
    c = get_h_w_c(img)[2]
    if opacity == 100 and c == 4:
        return img
    imgout = convert_to_bgra(img, c)
    opacity /= 100

    imgout[:, :, 3] *= opacity

    return imgout
