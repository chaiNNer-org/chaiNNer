from __future__ import annotations

import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, BorderInput, NumberInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.image_utils import create_border
from ...utils.utils import Padding


@NodeFactory.register("chainner:image:create_border")
class CreateBorderNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Creates a border around the image."
        self.inputs = [
            ImageInput(),
            BorderInput(),
            NumberInput("Amount", unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input0.width + Input2 * 2",
                    height="Input0.height + Input2 * 2",
                    channels="BorderType::getOutputChannels(Input1, Input0.channels)",
                )
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Create Border"
        self.icon = "BsBorderOuter"
        self.sub = "Miscellaneous"

    def run(self, img: np.ndarray, border_type: int, amount: int) -> np.ndarray:
        return create_border(img, border_type, Padding.all(amount))
