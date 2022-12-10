from __future__ import annotations

import numpy as np

from . import category as ImageCategory
from ...api.node_base import NodeBase
from ...api.node_factory import NodeFactory
from ...api.inputs import ImageInput
from ...api.outputs import LargeImageOutput


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
