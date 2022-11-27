from __future__ import annotations

import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    NumberInput,
    SliderInput,
)
from ...properties.outputs import ImageOutput
from ...properties import expression


@NodeFactory.register("chainner:image:create_color")
class CreateColorNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Create an image of specified dimensions filled with a specified color."
        )
        self.inputs = [
            NumberInput("Width", minimum=1, unit="px", default=1),
            NumberInput("Height", minimum=1, unit="px", default=1),
            SliderInput(
                "Red",
                minimum=0,
                maximum=255,
                gradient=["#000000", "#ff0000"],
            ),
            SliderInput(
                "Green",
                minimum=0,
                maximum=255,
                gradient=["#000000", "#00ff00"],
            ),
            SliderInput(
                "Blue",
                minimum=0,
                maximum=255,
                gradient=["#000000", "#0000ff"],
            ),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input0",
                    height="Input1",
                    channels="3",
                )
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Create Color"
        self.icon = "MdFormatColorFill"
        self.sub = "Miscellaneous"

    def run(
        self, width: int, height: int, red: int, green: int, blue: int
    ) -> np.ndarray:
        img = np.full((height, width, 3), (blue, green, red), dtype=np.uint8)
        return (img / 255.0).astype(np.float32)
