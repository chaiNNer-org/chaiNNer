from __future__ import annotations

import cv2
import numpy as np

from ...impl.image_utils import normalize, to_uint8
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageFilterCategory


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
        self.category = ImageFilterCategory
        self.name = "Canny Edge Detection"
        self.icon = "MdAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        t_lower: int,
        t_upper: int,
    ) -> np.ndarray:
        edges = cv2.Canny(to_uint8(img, normalized=True), t_lower, t_upper)
        return normalize(edges)
