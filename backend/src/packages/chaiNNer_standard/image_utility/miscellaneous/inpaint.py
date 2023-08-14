from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

import navi
from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput

from .. import miscellaneous_group


class InpaintAlgorithm(Enum):
    NS = cv2.INPAINT_NS
    TELEA = cv2.INPAINT_TELEA


@miscellaneous_group.register(
    schema_id="chainner:image:inpaint",
    name="Inpaint",
    description=[
        "Inpaint an image with given mask.",
        "Masks must typically be made outside of chaiNNer.",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput(channels=[1, 3]),
        ImageInput(label="Mask", channels=1).with_docs(
            "An inpainting mask is a grayscale image where white represents what to inpaint and black represents what to keep.",
            "This must typically be made outside of chaiNNer.",
            hint=True,
        ),
        EnumInput(
            InpaintAlgorithm,
            option_labels={
                InpaintAlgorithm.NS: "Navier Stokes",
                InpaintAlgorithm.TELEA: "Telea",
            },
        ),
        NumberInput(
            "Search Radius",
            minimum=0,
            default=1,
            precision=1,
            controls_step=1,
        ),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                width="Input0.width & Input1.width",
                height="Input0.height & Input1.height",
                channels="Input0.channels",
            )
        ).with_never_reason("The given image and mask must have the same resolution.")
    ],
    limited_to_8bpc=True,
)
def inpaint_node(
    img: np.ndarray,
    mask: np.ndarray,
    inpaint_method: InpaintAlgorithm,
    radius: float,
) -> np.ndarray:
    """Inpaint an image"""

    assert (
        img.shape[:2] == mask.shape[:2]
    ), "Input image and mask must have the same resolution"

    img = to_uint8(img, normalized=True)
    mask = to_uint8(mask, normalized=True)
    return cv2.inpaint(img, mask, radius, inpaint_method.value)
