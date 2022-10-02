from __future__ import annotations

from typing import Tuple

import numpy as np

from ...categories import ImageDimensionCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import NumberOutput
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:get_dims")
class GetDimensionsNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Get the Height, Width, and number of Channels from an image."
        )
        self.inputs = [
            ImageInput(),
        ]
        self.outputs = [
            NumberOutput("Width", output_type="Input0.width"),
            NumberOutput("Height", output_type="Input0.height"),
            NumberOutput("Channels", output_type="Input0.channels"),
        ]
        self.category = ImageDimensionCategory
        self.name = "Get Dimensions"
        self.icon = "BsRulers"
        self.sub = "Utility"

    def run(
        self,
        img: np.ndarray,
    ) -> Tuple[int, int, int]:
        h, w, c = get_h_w_c(img)
        return w, h, c
