from __future__ import annotations

import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, FillColorDropdown, NumberInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...impl.image_utils import shift


@NodeFactory.register("chainner:image:shift")
class ShiftNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Shift an image by an x, y amount."
        self.inputs = [
            ImageInput(),
            NumberInput("Amount X", minimum=None, unit="px"),
            NumberInput("Amount Y", minimum=None, unit="px"),
            FillColorDropdown(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input0.width",
                    height="Input0.height",
                    channels="FillColor::getOutputChannels(Input3, Input0.channels)",
                )
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Shift"
        self.icon = "BsGraphDown"
        self.sub = "Modification"

    def run(
        self,
        img: np.ndarray,
        amount_x: int,
        amount_y: int,
        fill: int,
    ) -> np.ndarray:
        return shift(img, amount_x, amount_y, fill)
