from __future__ import annotations
from enum import Enum

import cv2
import numpy as np

from . import category as ImageUtilityCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, EnumInput
from ...properties.outputs import ImageOutput


class InpaintAlgorithm(Enum):
    NS = cv2.INPAINT_NS
    TELEA = cv2.INPAINT_TELEA


@NodeFactory.register("chainner:image:inpaint")
class InpaintNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Inpaint Image"
        self.inputs = [
            ImageInput(channels=[1, 3]),
            ImageInput(label="Mask", channels=1),
            EnumInput(
                InpaintAlgorithm,
                option_labels={
                    InpaintAlgorithm.NS: "Navier Stokes",
                    InpaintAlgorithm.TELEA: "Telea",
                },
            ),
            NumberInput(
                "Search Radius",
                minimum=0,
                default=1,
                precision=1,
                controls_step=1,
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageUtilityCategory
        self.name = "Inpaint"
        self.icon = "MdOutlineAutoFixHigh"
        self.sub = "Miscellaneous"

    def run(
        self,
        img: np.ndarray,
        mask: np.ndarray,
        inpaint_method: InpaintAlgorithm,
        radius: float,
    ) -> np.ndarray:
        """Inpaint can be used to remove unwanted elements from an image,
        such as dust and scratches in scanned photographs."""

        assert (
            img.shape[:2] == mask.shape[:2]
        ), "Input image and mask must have the same resolution"

        img = (img * 255).astype("uint8")
        mask = (mask * 255).astype("uint8")
        img = cv2.inpaint(img, mask, radius, inpaint_method.value)

        return img.astype("float32") / 255
