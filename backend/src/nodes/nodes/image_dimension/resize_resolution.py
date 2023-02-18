from __future__ import annotations

import numpy as np
from sanic.log import logger

from ...impl.pil_utils import InterpolationMethod, resize
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput, InterpolationInput, NumberInput
from ...properties.outputs import ImageOutput
from . import category as ImageDimensionCategory


@NodeFactory.register("chainner:image:resize_resolution")
class ImResizeToResolutionNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Resize an image to an exact resolution. "
            "Auto uses box for downsampling and lanczos for upsampling."
        )
        self.inputs = [
            ImageInput(),
            NumberInput("Width", minimum=1, default=1, unit="px"),
            NumberInput("Height", minimum=1, default=1, unit="px"),
            InterpolationInput(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="Input1",
                    height="Input2",
                    channels="Input0.channels",
                )
            )
        ]
        self.category = ImageDimensionCategory
        self.name = "Resize (Resolution)"
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resize"

    def run(
        self,
        img: np.ndarray,
        width: int,
        height: int,
        interpolation: InterpolationMethod,
    ) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.debug(f"Resizing image to {width}x{height} via {interpolation}")

        out_dims = (width, height)

        return resize(img, out_dims, interpolation)
