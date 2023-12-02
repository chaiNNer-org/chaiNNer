from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import threshold_group


class AdaptiveThresholdType(Enum):
    BINARY = cv2.THRESH_BINARY
    BINARY_INV = cv2.THRESH_BINARY_INV


_THRESHOLD_TYPE_LABELS: dict[AdaptiveThresholdType, str] = {
    AdaptiveThresholdType.BINARY: "Binary",
    AdaptiveThresholdType.BINARY_INV: "Binary (Inverted)",
}


class AdaptiveMethod(Enum):
    MEAN = cv2.ADAPTIVE_THRESH_MEAN_C
    GAUSSIAN = cv2.ADAPTIVE_THRESH_GAUSSIAN_C


_ADAPTIVE_METHOD_LABELS: dict[AdaptiveMethod, str] = {
    AdaptiveMethod.MEAN: "Mean",
    AdaptiveMethod.GAUSSIAN: "Gaussian",
}


@threshold_group.register(
    schema_id="chainner:image:threshold_adaptive",
    name="Threshold (Adaptive)",
    description="Similar to regular threshold, but determines the threshold for a pixel based on a small region around it.",
    icon="MdAutoGraph",
    inputs=[
        ImageInput(channels=1),
        EnumInput(
            AdaptiveThresholdType,
            "Threshold Type",
            default=AdaptiveThresholdType.BINARY,
            option_labels=_THRESHOLD_TYPE_LABELS,
        ).with_id(3),
        SliderInput(
            "Maximum Value",
            maximum=100,
            default=100,
            precision=1,
            controls_step=1,
        ).with_id(1),
        EnumInput(
            AdaptiveMethod,
            "Adaptive Method",
            default=AdaptiveMethod.MEAN,
            option_labels=_ADAPTIVE_METHOD_LABELS,
        ).with_id(2),
        NumberInput("Block Radius", default=1, minimum=1).with_id(4),
        NumberInput(
            "Constant Subtraction",
            minimum=-100,
            maximum=100,
            default=0,
            precision=1,
        )
        .with_id(5)
        .with_docs(
            "A constant value that is subtracted from the automatically determined adaptive threshold.",
            "Assuming that **Threshold Type** is *Binary*, then higher values will result in more white pixels and lower values will result in more black pixels.",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
    limited_to_8bpc=True,
)
def threshold_adaptive_node(
    img: np.ndarray,
    threshold_type: AdaptiveThresholdType,
    max_value: float,
    adaptive_method: AdaptiveMethod,
    block_radius: int,
    c: float,
) -> np.ndarray:
    # Adaptive threshold requires uint8 input
    img = to_uint8(img, normalized=True)

    max_value = max_value / 100 * 255

    return cv2.adaptiveThreshold(
        img,
        max_value,
        adaptive_method.value,
        threshold_type.value,
        block_radius * 2 + 1,
        round(c / 100 * 255),
    )
