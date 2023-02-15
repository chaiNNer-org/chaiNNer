from __future__ import annotations
from enum import Enum

import cv2
import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, EnumInput
from ...properties.outputs import ImageOutput


class MorphOperation(Enum):
    DILATE = "Dilate"
    ERODE = "Erode"


class MorphShape(Enum):
    RECTANGLE = cv2.MORPH_RECT
    ELLIPSE = cv2.MORPH_ELLIPSE
    CROSS = cv2.MORPH_CROSS


@NodeFactory.register("chainner:image:dilate_erode")
class DilateErodeNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Dilate or Erode an image"
        self.inputs = [
            ImageInput(),
            EnumInput(MorphOperation),
            EnumInput(
                MorphShape,
                option_labels={
                    MorphShape.RECTANGLE: "Rectangle",
                    MorphShape.ELLIPSE: "Ellipse",
                    MorphShape.CROSS: "Cross",
                },
            ),
            NumberInput(
                "Size",
                minimum=0,
                default=5,
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
        self.name = "Dilate/Erode"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        morph_operation: MorphOperation,
        morph_shape: MorphShape,
        size: int,
        iterations: int,
    ) -> np.ndarray:
        """Dilate or Erode an image"""

        if size == 0 or iterations == 0:
            return img

        element = cv2.getStructuringElement(morph_shape.value, (size, size))
        operation = (
            cv2.dilate if morph_operation == MorphOperation.DILATE else cv2.erode
        )

        return operation(img, element, iterations=iterations)
