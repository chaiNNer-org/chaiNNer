from __future__ import annotations

import numpy as np

from ...impl.image_utils import BorderType, create_border
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import BorderInput, ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from ...utils.utils import Padding
from . import category as ImageUtilityCategory


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

    def run(self, img: np.ndarray, border_type: BorderType, amount: int) -> np.ndarray:
        return create_border(img, border_type, Padding.all(amount))
