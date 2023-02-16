from __future__ import annotations
import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.utils import get_h_w_c


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


@NodeFactory.register("chainner:image:lut")
class LutNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Apply a look up table (LUT) to a grayscale image."
            " Only the top row of pixels (y=0) of the LUT will be used to do the look up."
        )
        self.inputs = [
            ImageInput(channels=1),
            ImageInput("LUT"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(size_as="Input0", channels_as="Input1")
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Apply LUT"
        self.icon = "MdGradient"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        lut: np.ndarray,
    ) -> np.ndarray:
        # convert to the size of the LUT
        _, w, _ = get_h_w_c(lut)
        img = quantize(img, w)

        # only use top row of lut
        return np.take(lut[0], img, axis=0)
