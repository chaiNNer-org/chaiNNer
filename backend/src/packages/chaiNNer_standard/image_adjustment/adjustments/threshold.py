from __future__ import annotations

from enum import Enum
from typing import Dict

import cv2
import numpy as np

from nodes.groups import if_enum_group
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
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
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def threshold_node(
    img: np.ndarray,
    threshold: float,
    thresh_type: ThresholdType,
    max_value: float,
) -> np.ndarray:
    threshold /= 100
    max_value /= 100

    _, result = cv2.threshold(img, threshold, max_value, thresh_type.value)

    return result
