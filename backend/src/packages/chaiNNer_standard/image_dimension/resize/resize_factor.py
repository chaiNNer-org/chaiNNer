from __future__ import annotations

import numpy as np
from sanic.log import logger

import navi
from nodes.impl.pil_utils import InterpolationMethod, resize
from nodes.properties.inputs import ImageInput, InterpolationInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c, round_half_up

from .. import resize_group


@resize_group.register(
    schema_id="chainner:image:resize_factor",
    name="Resize (Factor)",
    description=(
        "Resize an image by a percent scale factor. "
        "Auto uses box for downsampling and lanczos for upsampling."
    ),
    icon="MdOutlinePhotoSizeSelectLarge",
    inputs=[
        ImageInput(),
        NumberInput(
            "Scale Factor",
            precision=4,
            controls_step=25.0,
            default=100.0,
            unit="%",
        ),
        InterpolationInput(),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="max(1, int & round(Input0.width * Input1 / 100))",
                height="max(1, int & round(Input0.height * Input1 / 100))",
                channels_as="Input0",
            ),
            assume_normalized=True,
        )
    ],
)
def resize_factor_node(
    img: np.ndarray, scale: float, interpolation: InterpolationMethod
) -> np.ndarray:
    """Takes an image and resizes it"""

    logger.debug(f"Resizing image by {scale} via {interpolation}")

    h, w, _ = get_h_w_c(img)
    out_dims = (
        max(round_half_up(w * (scale / 100)), 1),
        max(round_half_up(h * (scale / 100)), 1),
    )

    return resize(img, out_dims, interpolation)
