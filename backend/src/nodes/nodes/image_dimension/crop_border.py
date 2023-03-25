from __future__ import annotations

import numpy as np

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c
from . import category as ImageDimensionCategory


@NodeFactory.register("chainner:image:crop_border")
class BorderCropNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Crop an image based on a constant border margin around the entire image."
        )
        self.inputs = [
            ImageInput(),
            NumberInput("Amount", unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="(Input0.width - Input1 * 2) & int(1..)",
                    height="(Input0.height - Input1 * 2) & int(1..)",
                    channels_as="Input0",
                )
            ).with_never_reason(
                "The cropped area would result in an image with no width or no height."
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Crop (Border)"
        self.icon = "MdCrop"
        self.sub = "Crop"

    def run(self, img: np.ndarray, amount: int) -> np.ndarray:
        h, w, _ = get_h_w_c(img)

        assert 2 * amount < h, "Cropped area would result in an image with no height"
        assert 2 * amount < w, "Cropped area would result in an image with no width"

        result = img[amount : h - amount, amount : w - amount]

        return result
