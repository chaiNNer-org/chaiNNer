from __future__ import annotations

import numpy as np

from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import ImageInput
from ....api.outputs import LargeImageOutput


class View(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "See an inline preview of the image in the editor."
        self.inputs = [ImageInput()]
        self.outputs = [
            LargeImageOutput("Preview", image_type="Input0", has_handle=False)
        ]
        self.name = "View Image"
        self.icon = "BsEyeFill"

        self.side_effects = True

    def run(self, img: np.ndarray):
        return img
