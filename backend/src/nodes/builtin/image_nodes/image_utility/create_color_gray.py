from __future__ import annotations

import numpy as np

from . import category as ImageUtilityCategory
from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import (
    NumberInput,
    SliderInput,
)
from ....api.outputs import ImageOutput
from ....api import expression


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
