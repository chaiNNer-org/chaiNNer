from __future__ import annotations

import numpy as np

from . import category as ImageDimensionCategory
from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import ImageInput, NumberInput
from ....api.outputs import ImageOutput
from ....api import expression
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:crop_edges")
class EdgeCropNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Crop an image using separate amounts from each edge."
        self.inputs = [
            ImageInput(),
            NumberInput("Top", unit="px"),
            NumberInput("Left", unit="px"),
            NumberInput("Right", unit="px"),
            NumberInput("Bottom", unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="(Input0.width - (Input2 + Input3)) & int(1..)",
                    height="(Input0.height - (Input1 + Input4)) & int(1..)",
                    channels_as="Input0",
                )
            ).with_never_reason(
                "The cropped area would result in an image with no width or no height."
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Crop (Edges)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(
        self, img: np.ndarray, top: int, left: int, right: int, bottom: int
    ) -> np.ndarray:
        h, w, _ = get_h_w_c(img)

        assert top + bottom < h, "Cropped area would result in an image with no height"
        assert left + right < w, "Cropped area would result in an image with no width"

        result = img[top : h - bottom, left : w - right]

        return result
