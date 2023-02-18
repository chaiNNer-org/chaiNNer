from __future__ import annotations

import numpy as np

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import LargeImageOutput
from . import category as ImageCategory


@NodeFactory.register("chainner:image:view")
class ImViewNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "See an inline preview of the image in the editor."
        self.inputs = [ImageInput()]
        self.outputs = [
            LargeImageOutput("Preview", image_type="Input0", has_handle=False)
        ]
        self.category = ImageCategory
        self.name = "View Image"
        self.icon = "BsEyeFill"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, img: np.ndarray):
        return img
