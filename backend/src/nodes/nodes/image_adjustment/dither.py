from __future__ import annotations

import cv2
import numpy as np
from sanic.log import logger

from . import category as ImageAdjustmentCategory
from ...impl.dithering import bayer_filter, BayerThresholdMapSize, BAYER_THRESHOLD_MAP_SIZE_LABELS
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, EnumInput
from ...properties.outputs import ImageOutput


@NodeFactory.register("chainner:image:dither")
class DitherNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply a Bayer ordered dithering algorithm."
        self.inputs = [
            ImageInput(),
            NumberInput("Colors per channel", minimum=2, default=8),
            EnumInput(
                BayerThresholdMapSize,
                option_labels=BAYER_THRESHOLD_MAP_SIZE_LABELS,
                default_value=BayerThresholdMapSize.SIZE16),
        ]
        self.outputs = [ImageOutput()]
        self.category = ImageAdjustmentCategory
        self.name = "Dither"
        self.icon = "MdShowChart"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray, num_colors: int, map_size: BayerThresholdMapSize) -> np.ndarray:
        return bayer_filter(img, map_size=map_size, num_colors=num_colors)