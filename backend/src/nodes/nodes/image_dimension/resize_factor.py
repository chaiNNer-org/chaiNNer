from __future__ import annotations

import numpy as np
from sanic.log import logger

from . import category as ImageDimensionCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput, InterpolationInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...impl.pil_utils import resize, InterpolationMethod
from ...utils.utils import get_h_w_c, round_half_up


@NodeFactory.register("chainner:image:resize_factor")
class ImResizeByFactorNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Resize an image by a percent scale factor. "
            "Auto uses box for downsampling and lanczos for upsampling."
        )
        self.inputs = [
            ImageInput(),
            NumberInput(
                "Scale Factor",
                precision=4,
                controls_step=25.0,
                default=100.0,
                unit="%",
            ),
            InterpolationInput(),
        ]
        self.category = ImageDimensionCategory
        self.name = "Resize (Factor)"
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="max(1, int & round(Input0.width * Input1 / 100))",
                    height="max(1, int & round(Input0.height * Input1 / 100))",
                    channels_as="Input0",
                )
            )
        ]
        self.icon = "MdOutlinePhotoSizeSelectLarge"
        self.sub = "Resize"

    def run(
        self, img: np.ndarray, scale: float, interpolation: InterpolationMethod
    ) -> np.ndarray:
        """Takes an image and resizes it"""

        logger.debug(f"Resizing image by {scale} via {interpolation}")

        h, w, _ = get_h_w_c(img)
        out_dims = (
            max(round_half_up(w * (scale / 100)), 1),
            max(round_half_up(h * (scale / 100)), 1),
        )

        return resize(img, out_dims, interpolation)
