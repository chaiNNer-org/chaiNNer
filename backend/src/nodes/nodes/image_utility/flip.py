from __future__ import annotations

import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, EnumInput
from ...properties.outputs import ImageOutput
from ...impl.image_utils import FlipAxis


@NodeFactory.register("chainner:image:flip")
class FlipNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Flip an image."
        self.inputs = [
            ImageInput("Image"),
            EnumInput(FlipAxis),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageUtilityCategory
        self.name = "Flip"
        self.icon = "MdFlip"
        self.sub = "Modification"

    def run(self, img: np.ndarray, axis: FlipAxis) -> np.ndarray:
        return axis.flip(img)
