from __future__ import annotations

import numpy as np

from . import category as ImageDimensionCategory
from ...api.node_base import NodeBase
from ...api.node_factory import NodeFactory
from ...api.inputs import ImageInput, NumberInput
from ...api.outputs import ImageOutput
from ...api import expression
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:crop_offsets")
class CropNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Crop an image based on offset from the top-left corner, and the wanted resolution."
        self.inputs = [
            ImageInput(),
            NumberInput("Top Offset", unit="px"),
            NumberInput("Left Offset", unit="px"),
            NumberInput("Height", unit="px", minimum=1, default=1),
            NumberInput("Width", unit="px", minimum=1, default=1),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="min(Input4, Input0.width - Input2) & int(1..)",
                    height="min(Input3, Input0.height - Input1) & int(1..)",
                    channels_as="Input0",
                )
            ).with_never_reason(
                "The cropped area would result in an image with no width or no height."
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Crop (Offsets)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(
        self, img: np.ndarray, top: int, left: int, height: int, width: int
    ) -> np.ndarray:
        h, w, _ = get_h_w_c(img)

        assert top < h, "Cropped area would result in an image with no height"
        assert left < w, "Cropped area would result in an image with no width"

        result = img[top : top + height, left : left + width]

        return result
