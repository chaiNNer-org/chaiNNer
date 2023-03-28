from __future__ import annotations

import cv2
import numpy as np
from sanic.log import logger

from nodes.properties.inputs import ImageInput, SliderInput, ThresholdInput
from nodes.properties.outputs import ImageOutput

from .. import adjustments_group


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
        SliderInput(
            "Maximum Value",
            maximum=100,
            default=100,
            precision=1,
            controls_step=1,
        ),
        ThresholdInput(),
    ],
    outputs=[ImageOutput(image_type="Input0")],
)
def threshold_node(
    img: np.ndarray, thresh: float, maxval: float, thresh_type: int
) -> np.ndarray:
    """Takes an image and applies a threshold to it"""

    logger.debug(f"thresh {thresh}, maxval {maxval}, type {thresh_type}")

    real_thresh = thresh / 100
    real_maxval = maxval / 100

    logger.debug(f"real_thresh {real_thresh}, real_maxval {real_maxval}")

    _, result = cv2.threshold(img, real_thresh, real_maxval, thresh_type)

    return result
