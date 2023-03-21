from __future__ import annotations

import cv2
import numpy as np

from ...impl.image_utils import normalize, to_uint8
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    AdaptiveMethodInput,
    AdaptiveThresholdInput,
    ImageInput,
    NumberInput,
    SliderInput,
)
from ...properties.outputs import ImageOutput
from . import category as ImageAdjustmentCategory


@NodeFactory.register("chainner:image:threshold_adaptive")
class AdaptiveThresholdNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Similar to regular threshold, but determines the threshold for a pixel based on a small region around it."
        self.inputs = [
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
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageAdjustmentCategory
        self.name = "Threshold (Adaptive)"
        self.icon = "MdAutoGraph"
        self.sub = "Adjustments"

    def run(
        self,
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

        return normalize(result)
