from __future__ import annotations

import numpy as np

from nodes.node_base import NodeBase
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import LargeImageOutput

from . import node_group


@node_group.register(
    schema_id="chainner:image:view",
    name="View Image",
    description="See an inline preview of the image in the editor.",
    icon="BsEyeFill",
)
class ImViewNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.inputs = [ImageInput()]
        self.outputs = [
            LargeImageOutput("Preview", image_type="Input0", has_handle=False)
        ]

        self.side_effects = True

    def run(self, img: np.ndarray):
        return img
