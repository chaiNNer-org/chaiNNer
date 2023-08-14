from __future__ import annotations

import cv2
import numpy as np

from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import (
    AdaptiveMethodInput,
    AdaptiveThresholdInput,
    ImageInput,
    NumberInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


@adjustments_group.register(
    schema_id="chainner:image:threshold_adaptive",
    name="Threshold (Adaptive)",
    description="Similar to regular threshold, but determines the threshold for a pixel based on a small region around it.",
    icon="MdAutoGraph",
    inputs=[
        ImageInput(channels=1),
        SliderInput(
            "Maximum Value",
            maximum=100,
            default=100,
            precision=1,
            controls_step=1,
        ),
        AdaptiveMethodInput(),
        AdaptiveThresholdInput(),
        NumberInput("Block Radius", default=1, minimum=1),
        NumberInput("Mean Subtraction"),
    ],
    outputs=[ImageOutput(image_type="Input0")],
    limited_to_8bpc=True,
)
def threshold_adaptive_node(
    img: np.ndarray,
    maxval: float,
    adaptive_method: int,
    thresh_type: int,
    block_radius: int,
    c: int,
) -> np.ndarray:
    """Takes an image and applies an adaptive threshold to it"""

    # Adaptive threshold requires uint8 input
    img = to_uint8(img, normalized=True)

    real_maxval = maxval / 100 * 255

    result = cv2.adaptiveThreshold(
        img,
        real_maxval,
        adaptive_method,
        thresh_type,
        block_radius * 2 + 1,
        c,
    )

    return result
