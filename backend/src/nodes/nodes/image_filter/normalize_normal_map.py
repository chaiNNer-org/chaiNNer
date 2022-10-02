from __future__ import annotations

import cv2
import numpy as np

from sanic.log import logger

from ...categories import ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.image_utils import normalize_normals


@NodeFactory.register("chainner:image:normalize_normal_map")
class NormalizeNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Normalizes the given normal map.
            Only the R and G channels of the input image will be used to compute the unit vectors."""
        self.inputs = [
            ImageInput("Normal Map", expression.Image(channels=[3, 4])),
        ]
        self.outputs = [
            ImageOutput("Normal Map", expression.Image(size_as="Input0", channels=3)),
        ]
        self.category = ImageFilterCategory
        self.name = "Normalize Normal Map"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Normal Map"

    def run(self, img: np.ndarray) -> np.ndarray:
        """Takes a normal map and normalizes it"""

        logger.info(f"Normalizing image")
        assert img.ndim == 3, "The input image must be an RGB or RGBA image"

        # Convert BGR to XY
        x = img[:, :, 2] * 2 - 1
        y = img[:, :, 1] * 2 - 1

        x, y, z = normalize_normals(x, y)

        r_norm = (x + 1) * 0.5
        g_norm = (y + 1) * 0.5
        b_norm = z

        return cv2.merge((b_norm, g_norm, r_norm))
