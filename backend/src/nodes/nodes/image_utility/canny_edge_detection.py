from __future__ import annotations

import cv2
import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...impl.image_utils import normalize


@NodeFactory.register("chainner:image:canny_edge_detection")
class CannyEdgeDetectionNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Detect the edges of the input image and output as black and white image."
        )
        self.inputs = [
            ImageInput(),
            NumberInput("Lower Threshold", minimum=0, default=100),
            NumberInput("Upper Threshold", minimum=0, default=300),
        ]
        self.outputs = [
            ImageOutput(image_type=expression.Image(size_as="Input0"), channels=1)
        ]
        self.category = ImageUtilityCategory
        self.name = "Canny Edge Detection"
        self.icon = "MdAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        t_lower: int,
        t_upper: int,
    ) -> np.ndarray:
        img = (img * 255).astype(np.uint8)

        edges = cv2.Canny(img, t_lower, t_upper)

        return normalize(edges)
