from __future__ import annotations

import cv2
import numpy as np

from ....categories import ImageUtilityCategory
from ....node_base import NodeBase
from ....node_factory import NodeFactory
from ....properties.inputs import ImageInput, BlendModeDropdown
from ....properties.outputs import ImageOutput
from ....properties import expression
from ....utils.image_utils import (
    as_2d_grayscale,
    blend_images,
)
from ....utils.pil_utils import convert_to_BGRA
from ....utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:blend")
class ImBlend(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Blends overlay image onto base image using
            specified mode."""
        self.inputs = [
            ImageInput(
                "Base Layer",
                image_type=expression.Image(channels=[1, 3, 4]),
            ),
            ImageInput(
                "Overlay Layer",
                image_type=expression.Image(channels=[1, 3, 4]),
            ),
            BlendModeDropdown(),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    width="max(Input0.width, Input1.width)",
                    height="max(Input0.height, Input1.height)",
                    channels="max(Input0.channels, Input1.channels)",
                )
            ),
        ]
        self.category = ImageUtilityCategory
        self.name = "Blend Images"
        self.icon = "BsLayersHalf"
        self.sub = "Compositing"

    def run(
        self,
        base: np.ndarray,
        ov: np.ndarray,
        blend_mode: int,
    ) -> np.ndarray:
        """Blend images together"""

        b_h, b_w, b_c = get_h_w_c(base)
        o_h, o_w, _ = get_h_w_c(ov)
        max_h = max(b_h, o_h)
        max_w = max(b_w, o_w)

        if (b_w, b_h) == (o_w, o_h):
            # we don't have to do any size adjustments
            return blend_images(ov, base, blend_mode)

        # Pad base image with transparency if necessary to match size with overlay
        top = bottom = left = right = 0
        if b_h < max_h:
            top = (max_h - b_h) // 2
            bottom = max_h - b_h - top
        if b_w < max_w:
            left = (max_w - b_w) // 2
            right = max_w - b_w - left
        if any((top, bottom, left, right)):
            # copyMakeBorder will create black border if base not converted to RGBA first
            base = convert_to_BGRA(base, b_c)
            base = cv2.copyMakeBorder(
                base, top, bottom, left, right, cv2.BORDER_CONSTANT, value=0
            )
        else:  # Make sure cached image not being worked on regardless
            base = base.copy()

        # Center overlay
        center_x = base.shape[1] // 2
        center_y = base.shape[0] // 2
        x_offset = center_x - (o_w // 2)
        y_offset = center_y - (o_h // 2)

        blended_img = blend_images(
            ov,
            base[y_offset : y_offset + o_h, x_offset : x_offset + o_w],
            blend_mode,
        )

        result = base  # Just so the names make sense
        result_c = get_h_w_c(result)[2]
        blend_c = get_h_w_c(blended_img)[2]

        # Have to ensure blend and result have same shape
        if result_c < blend_c:
            if blend_c == 4:
                result = convert_to_BGRA(result, result_c)
            else:
                result = as_2d_grayscale(result)
                result = np.dstack((result, result, result))
        result[y_offset : y_offset + o_h, x_offset : x_offset + o_w] = blended_img

        return result
