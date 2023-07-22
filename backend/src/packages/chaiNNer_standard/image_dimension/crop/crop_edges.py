from __future__ import annotations

import numpy as np

import navi
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import crop_group


@crop_group.register(
    schema_id="chainner:image:crop_edges",
    name="Crop (Edges)",
    description="Crop an image using separate amounts from each edge.",
    icon="MdCrop",
    inputs=[
        ImageInput(),
        NumberInput("Top", unit="px"),
        NumberInput("Left", unit="px"),
        NumberInput("Right", unit="px"),
        NumberInput("Bottom", unit="px"),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="(Input0.width - (Input2 + Input3)) & int(1..)",
                height="(Input0.height - (Input1 + Input4)) & int(1..)",
                channels_as="Input0",
            ),
            assume_normalized=True,
        ).with_never_reason(
            "The cropped area would result in an image with no width or no height."
        )
    ],
)
def crop_edges_node(
    img: np.ndarray, top: int, left: int, right: int, bottom: int
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)

    assert top + bottom < h, "Cropped area would result in an image with no height"
    assert left + right < w, "Cropped area would result in an image with no width"

    result = img[top : h - bottom, left : w - right]

    return result
