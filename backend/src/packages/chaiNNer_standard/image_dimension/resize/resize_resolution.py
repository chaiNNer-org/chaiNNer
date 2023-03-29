from __future__ import annotations

import numpy as np
from sanic.log import logger

from nodes.impl.pil_utils import InterpolationMethod, resize
from nodes.properties import expression
from nodes.properties.inputs import ImageInput, InterpolationInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import resize_group


@resize_group.register(
    schema_id="chainner:image:resize_resolution",
    name="Resize (Resolution)",
    description=(
        "Resize an image to an exact resolution. "
        "Auto uses box for downsampling and lanczos for upsampling."
    ),
    icon="MdOutlinePhotoSizeSelectLarge",
    inputs=[
        ImageInput(),
        NumberInput("Width", minimum=1, default=1, unit="px"),
        NumberInput("Height", minimum=1, default=1, unit="px"),
        InterpolationInput(),
    ],
    outputs=[
        ImageOutput(
            image_type=expression.Image(
                width="Input1",
                height="Input2",
                channels="Input0.channels",
            )
        )
    ],
)
def resize_resolution_node(
    img: np.ndarray,
    width: int,
    height: int,
    interpolation: InterpolationMethod,
) -> np.ndarray:
    """Takes an image and resizes it"""

    logger.debug(f"Resizing image to {width}x{height} via {interpolation}")

    out_dims = (width, height)

    return resize(img, out_dims, interpolation)
