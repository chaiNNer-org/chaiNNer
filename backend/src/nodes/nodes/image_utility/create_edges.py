from __future__ import annotations

import numpy as np

from ...categories import ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, BorderInput, NumberInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.image_utils import create_border


@NodeFactory.register("chainner:image:create_edges")
class CreateEdgesNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Creates an edge border around the image."
        self.inputs = [
            ImageInput(),
            BorderInput(),
            NumberInput("Top", unit="px"),
            NumberInput("Left", unit="px"),
            NumberInput("Right", unit="px"),
            NumberInput("Bottom", unit="px"),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input0.width + Input3 + Input4",
                    height="Input0.height + Input2 + Input5",
                    channels="BorderType::getOutputChannels(Input1, Input0.channels)",
                )
            )
        ]
        self.category = ImageUtilityCategory
        self.name = "Create Edges"
        self.icon = "BsBorderOuter"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        border_type: int,
        top: int,
        left: int,
        right: int,
        bottom: int,
    ) -> np.ndarray:
        return create_border(img, border_type, top, right, bottom, left)
