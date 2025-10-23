from __future__ import annotations

import numpy as np

import navi
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import miscellaneous_group


def quantize(img: np.ndarray, levels: int) -> np.ndarray:
    """
    Given an array for float32 values between 0 and 1, this will return a quantized version of the array with the given number of quantization levels.

    The type of the integers in the returned array will be the smallest unsigned integer type that can fit `levels` many values. E.g. uint8 is used for 256, and uint16 is used for 257 levels.
    """
    assert levels >= 1
    assert (
        levels <= 2**24
    ), "Quantizing float32 values with more than 2**24 levels doesn't make sense, because only integers up to 2**24 can be represented exactly using float32."

    q: np.ndarray = np.round(img * (levels - 1))

    if levels <= 256:
        return q.astype(np.uint8)
    elif levels <= 65536:
        return q.astype(np.uint16)
    else:
        return q.astype(np.uint32)


@miscellaneous_group.register(
    schema_id="chainner:image:lut",
    name="Apply Palette",
    description=(
        "Apply a color palette to a grayscale image."
        " Only the top row of pixels (y=0) of the palette will be used to do the look up."
    ),
    see_also="chainner:image:palette_from_image",
    icon="MdGradient",
    inputs=[
        ImageInput(channels=1),
        ImageInput("Palette"),
    ],
    outputs=[
        ImageOutput(image_type=navi.Image(size_as="Input0", channels_as="Input1"))
    ],
)
def apply_palette_node(
    img: np.ndarray,
    lut: np.ndarray,
) -> np.ndarray:
    # convert to the size of the LUT
    _, w, _ = get_h_w_c(lut)
    img = quantize(img, w)

    # only use top row of lut
    return np.take(lut[0], img, axis=0)
