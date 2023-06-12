from __future__ import annotations

import numpy as np

import navi
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import crop_group


@crop_group.register(
    schema_id="chainner:image:crop_offsets",
    name="Crop (Offsets)",
    description="Crop an image based on offset from the top-left corner, and the wanted resolution.",
    icon="MdCrop",
    inputs=[
        ImageInput(),
        NumberInput("Top Offset", unit="px"),
        NumberInput("Left Offset", unit="px"),
        NumberInput("Height", unit="px", minimum=1, default=1),
        NumberInput("Width", unit="px", minimum=1, default=1),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="min(Input4, Input0.width - Input2) & int(1..)",
                height="min(Input3, Input0.height - Input1) & int(1..)",
                channels_as="Input0",
            ),
            assume_normalized=True,
        ).with_never_reason(
            "The cropped area would result in an image with no width or no height."
        )
    ],
)
def crop_offsets_node(
    img: np.ndarray, top: int, left: int, height: int, width: int
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    assert top < h, "Cropped area would result in an image with no height"
    assert left < w, "Cropped area would result in an image with no width"

    result = img[top : top + height, left : left + width]

    return result
