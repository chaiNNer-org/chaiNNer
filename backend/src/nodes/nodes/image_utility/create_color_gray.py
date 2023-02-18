from __future__ import annotations

import numpy as np

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import NumberInput, SliderInput
from ...properties.outputs import ImageOutput
from . import category as ImageUtilityCategory


@NodeFactory.register("chainner:image:create_color_gray")
class CreateColorNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Create an image of specified dimensions filled with a specified grayscale color."
        self.inputs = [
            NumberInput("Width", minimum=1, unit="px", default=1),
            NumberInput("Height", minimum=1, unit="px", default=1),
            SliderInput(
                "Luma",
                minimum=0,
                maximum=255,
                default=126,
                gradient=["#000000", "#ffffff"],
            ),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input0",
                    height="Input1",
                    channels="1",
                )
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Create Color (Gray)"
        self.icon = "MdFormatColorFill"
        self.sub = "Create Images"

    def run(self, width: int, height: int, gray: int) -> np.ndarray:
        img = np.full((height, width), (gray), dtype=np.uint8)
        return (img / 255.0).astype(np.float32)
