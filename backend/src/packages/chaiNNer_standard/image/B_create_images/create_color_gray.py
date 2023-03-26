from __future__ import annotations

import numpy as np

from nodes.node_base import NodeBase
from nodes.properties import expression
from nodes.properties.inputs import NumberInput, SliderInput
from nodes.properties.outputs import ImageOutput

from . import node_group


@node_group.register(
    schema_id="chainner:image:create_color_gray",
    name="Create Color (Gray)",
    description="Create an image of specified dimensions filled with a specified grayscale color.",
    icon="MdFormatColorFill",
)
class CreateColorNode(NodeBase):
    def __init__(self):
        super().__init__()
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

    def run(self, width: int, height: int, gray: int) -> np.ndarray:
        return np.full((height, width), (gray / 255), dtype=np.float32)
