from __future__ import annotations
from enum import Enum

import cv2
import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, EnumInput
from ...properties.outputs import ImageOutput


class MorphShape(Enum):
    RECTANGLE = cv2.MORPH_RECT
    ELLIPSE = cv2.MORPH_ELLIPSE
    CROSS = cv2.MORPH_CROSS


@NodeFactory.register("chainner:image:dilate")
class DilateNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Dilate an image"
        self.inputs = [
            ImageInput(),
            EnumInput(
                MorphShape,
                option_labels={
                    MorphShape.RECTANGLE: "Square",
                    MorphShape.ELLIPSE: "Circle",
                    MorphShape.CROSS: "Cross",
                },
            ),
            NumberInput(
                "Radius",
                minimum=0,
                default=1,
                controls_step=1,
            ),
            NumberInput(
                "Iterations",
                minimum=0,
                default=1,
                controls_step=1,
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageUtilityCategory
        self.name = "Dilate"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        morph_shape: MorphShape,
        radius: int,
        iterations: int,
    ) -> np.ndarray:
        """Dilate an image"""

        if radius == 0 or iterations == 0:
            return img

        size = 2 * radius + 1
        element = cv2.getStructuringElement(morph_shape.value, (size, size))

        return cv2.dilate(img, element, iterations=iterations)
