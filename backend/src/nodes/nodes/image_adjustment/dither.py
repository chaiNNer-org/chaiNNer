from __future__ import annotations

import cv2
import numpy as np
from sanic.log import logger

from . import category as ImageAdjustmentCategory
from ...impl.dithering import bayer_filter
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, DropDownInput, get_number_type
from ...properties.outputs import ImageOutput


@NodeFactory.register("chainner:image:dither")
class DitherNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Apply a Bayer ordered dithering algorithm."
        self.inputs = [
            ImageInput(),
            NumberInput("Colors per channel", minimum=2, default=4),
            DropDownInput(
                input_type=get_number_type(0, 16, 0),
                label="Dither Map Size",
                options=[
                    {
                        "option": "No dithering",
                        "value": 0,
                    },
                    {
                        "option": "2x2",
                        "value": 2,
                    },
                    {
                        "option": "4x4",
                        "value": 4,
                    },
                    {
                        "option": "8x8",
                        "value": 8,
                    },
                    {
                        "option": "16x16",
                        "value": 16,
                    },
                ],
                default_value=16,
            )
        ]
        self.outputs = [ImageOutput()]
        self.category = ImageAdjustmentCategory
        self.name = "Dither"
        self.icon = "MdShowChart"
        self.sub = "Adjustments"

    def run(self, img: np.ndarray, num_colors: int, map_size: int) -> np.ndarray:
        return bayer_filter(img, map_size=map_size, num_colors=num_colors)
