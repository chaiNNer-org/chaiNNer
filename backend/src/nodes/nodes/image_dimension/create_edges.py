from __future__ import annotations

import numpy as np

from ...impl.image_utils import BorderType, create_border
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import BorderInput, ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from ...utils.utils import Padding
from . import category as ImageDimensionCategory


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
        self.category = ImageDimensionCategory
        self.name = "Create Edges"
        self.icon = "BsBorderOuter"
        self.sub = "Border"

    def run(
        self,
        img: np.ndarray,
        border_type: BorderType,
        top: int,
        left: int,
        right: int,
        bottom: int,
    ) -> np.ndarray:
        return create_border(img, border_type, Padding(top, right, bottom, left))
