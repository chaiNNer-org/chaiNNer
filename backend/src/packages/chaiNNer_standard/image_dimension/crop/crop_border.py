from __future__ import annotations

import numpy as np

import navi
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import crop_group


@crop_group.register(
    schema_id="chainner:image:crop_border",
    name="Crop (Border)",
    description=(
        "Crop an image based on a constant border margin around the entire image."
    ),
    icon="MdCrop",
    inputs=[
        ImageInput(),
        NumberInput("Amount", unit="px"),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="(Input0.width - Input1 * 2) & int(1..)",
                height="(Input0.height - Input1 * 2) & int(1..)",
                channels_as="Input0",
            ),
            assume_normalized=True,
        ).with_never_reason(
            "The cropped area would result in an image with no width or no height."
        )
    ],
)
def crop_border_node(img: np.ndarray, amount: int) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    assert 2 * amount < h, "Cropped area would result in an image with no height"
    assert 2 * amount < w, "Cropped area would result in an image with no width"

    result = img[amount : h - amount, amount : w - amount]

    return result
