from __future__ import annotations

from enum import Enum
from typing import Dict

import cv2
import numpy as np
from chainner_ext import binary_threshold

from nodes.groups import if_enum_group
from nodes.properties.inputs import BoolInput, EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


class ThresholdType(Enum):
    BINARY = cv2.THRESH_BINARY
    BINARY_INV = cv2.THRESH_BINARY_INV
    TRUNC = cv2.THRESH_TRUNC
    TO_ZERO = cv2.THRESH_TOZERO
    TO_ZERO_INV = cv2.THRESH_TOZERO_INV


_THRESHOLD_TYPE_LABELS: Dict[ThresholdType, str] = {
    ThresholdType.BINARY: "Binary",
    ThresholdType.BINARY_INV: "Binary (Inverted)",
    ThresholdType.TRUNC: "Truncated",
    ThresholdType.TO_ZERO: "To Zero",
    ThresholdType.TO_ZERO_INV: "To Zero (Inverted)",
}


@adjustments_group.register(
    schema_id="chainner:image:threshold",
    name="Threshold",
    description="Replaces pixels based on the threshold value. If the pixel value is smaller than the threshold, it is set to 0, otherwise it is set to the maximum value.",
    icon="MdShowChart",
    inputs=[
        ImageInput(),
        SliderInput(
            "Threshold",
            maximum=100,
            default=50,
            precision=1,
            controls_step=1,
        ),
        EnumInput(
            ThresholdType,
            "Threshold Type",
            default=ThresholdType.BINARY,
            option_labels=_THRESHOLD_TYPE_LABELS,
        ).with_id(3),
        if_enum_group(3, (ThresholdType.BINARY, ThresholdType.BINARY_INV))(
            SliderInput(
                "Maximum Value",
                maximum=100,
                default=100,
                precision=1,
                controls_step=1,
            ).with_id(2),
        ),
        BoolInput("Anti-aliasing", default=False).with_docs(
            "Enables sub-pixel precision. Bilinear interpolation is used to fill in values in between pixels.",
            "Conceptually, the option is equivalent to first upscaling the image by a factor of X (with linear interpolation), thresholding it, and then downscaling it by a factor of X (where X is 20 or more).",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
    see_also=[
        "chainner:image:generate_threshold",
        "chainner:image:threshold_adaptive",
    ],
)
def threshold_node(
    img: np.ndarray,
    threshold: float,
    thresh_type: ThresholdType,
    max_value: float,
    anti_aliasing: bool,
) -> np.ndarray:
    threshold /= 100
    max_value /= 100

    if not anti_aliasing:
        _, result = cv2.threshold(img, threshold, max_value, thresh_type.value)
        return result

    binary = binary_threshold(img, threshold, True)
    if thresh_type == ThresholdType.BINARY_INV:
        binary = 1 - binary

    if thresh_type == ThresholdType.BINARY or thresh_type == ThresholdType.BINARY_INV:
        if max_value < 1:
            binary *= max_value
        return binary
    elif thresh_type == ThresholdType.TRUNC:
        return binary * threshold + img * (1 - binary)
    elif thresh_type == ThresholdType.TO_ZERO:
        return binary * img
    elif thresh_type == ThresholdType.TO_ZERO_INV:
        return (1 - binary) * img
