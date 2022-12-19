from __future__ import annotations

import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...impl.normals.util import gr_to_xyz, xyz_to_bgr


@NodeFactory.register("chainner:image:normalize_normal_map")
class NormalizeNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Normalizes the given normal map.
            Only the R and G channels of the input image will be used to compute the unit vectors."""
        self.inputs = [
            ImageInput("Normal Map", channels=[3, 4]),
        ]
        self.outputs = [
            ImageOutput(
                "Normal Map",
                image_type=expression.Image(size_as="Input0"),
                channels=3,
            ),
        ]
        self.category = ImageFilterCategory
        self.name = "Normalize Normal Map"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Normal Map"

    def run(self, img: np.ndarray) -> np.ndarray:
        """Takes a normal map and normalizes it"""

        return xyz_to_bgr(gr_to_xyz(img))
