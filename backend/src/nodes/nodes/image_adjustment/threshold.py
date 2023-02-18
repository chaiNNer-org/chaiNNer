from __future__ import annotations

import cv2
import numpy as np
from sanic.log import logger

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, SliderInput, ThresholdInput
from ...properties.outputs import ImageOutput
from . import category as ImageAdjustmentCategory


@NodeFactory.register("chainner:image:threshold")
class ThresholdNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Replaces pixels based on the threshold value. If the pixel value is smaller than the threshold, it is set to 0, otherwise it is set to the maximum value."
        self.inputs = [
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
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Threshold"
        self.icon = "MdShowChart"
        self.sub = "Adjustments"

    def run(
        self, img: np.ndarray, thresh: float, maxval: float, thresh_type: int
    ) -> np.ndarray:
        """Takes an image and applies a threshold to it"""

        logger.debug(f"thresh {thresh}, maxval {maxval}, type {thresh_type}")

        real_thresh = thresh / 100
        real_maxval = maxval / 100

        logger.debug(f"real_thresh {real_thresh}, real_maxval {real_maxval}")

        _, result = cv2.threshold(img, real_thresh, real_maxval, thresh_type)

        return result
