from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

from ...impl.image_utils import normalize, to_uint8
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import EnumInput, ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageUtilityCategory


class InpaintAlgorithm(Enum):
    NS = cv2.INPAINT_NS
    TELEA = cv2.INPAINT_TELEA


@NodeFactory.register("chainner:image:inpaint")
class InpaintNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Inpaint an image with given mask."
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
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input0.width & Input1.width",
                    height="Input0.height & Input1.height",
                    channels="Input0.channels",
                )
            ).with_never_reason(
                "The given image and mask must have the same resolution."
            )
        ]
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
        """Inpaint an image"""

        assert (
            img.shape[:2] == mask.shape[:2]
        ), "Input image and mask must have the same resolution"

        img = to_uint8(img, normalized=True)
        mask = to_uint8(mask, normalized=True)
        result = cv2.inpaint(img, mask, radius, inpaint_method.value)

        return normalize(result)
