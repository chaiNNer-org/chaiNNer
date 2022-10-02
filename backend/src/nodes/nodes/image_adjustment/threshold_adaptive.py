from __future__ import annotations

import cv2
import numpy as np

from ...categories import ImageAdjustmentCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    ImageInput,
    SliderInput,
    AdaptiveMethodInput,
    AdaptiveThresholdInput,
    NumberInput,
)
from ...properties.outputs import ImageOutput
from ...properties import expression


@NodeFactory.register("chainner:image:threshold_adaptive")
class AdaptiveThresholdNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Similar to regular threshold, but determines the threshold for a pixel based on a small region around it."
        self.inputs = [
            ImageInput(image_type=expression.Image(channels=1)),
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

        assert (
            img.ndim == 2
        ), "Image must be grayscale (single channel) to apply an adaptive threshold"

        # Adaptive threshold requires uint8 input
        img = (img * 255).astype("uint8")

        real_maxval = maxval / 100 * 255

        result = cv2.adaptiveThreshold(
            img,
            real_maxval,
            adaptive_method,
            thresh_type,
            block_radius * 2 + 1,
            c,
        )

        return result.astype("float32") / 255
