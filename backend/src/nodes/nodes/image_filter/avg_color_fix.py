from __future__ import annotations

from math import ceil

import cv2
import numpy as np

from ...categories import ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NumberInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:average_color_fix")
class AverageColorFixNode(NodeBase):
    """Fixes the average color of an upscaled image"""

    def __init__(self):
        super().__init__()
        self.description = """Correct for upscaling model color shift by matching
         average color of Input Image to that of a smaller Reference Image.
         Using significant downscaling increases generalization of averaging effect
         and can reduce artifacts in the output."""
        self.inputs = [
            ImageInput("Image", image_type=expression.Image(channels=[3, 4])),
            ImageInput("Reference Image", image_type=expression.Image(channels=[3, 4])),
            NumberInput(
                "Reference Image Scale Factor",
                precision=4,
                controls_step=12.5,
                maximum=100.0,
                default=12.5,
                unit="%",
            ),
        ]
        self.outputs = [ImageOutput(image_type="Input0")]
        self.category = ImageFilterCategory
        self.name = "Average Color Fix"
        self.icon = "MdAutoFixHigh"
        self.sub = "Correction"

    def run(
        self, input_img: np.ndarray, ref_img: np.ndarray, scale_factor: float
    ) -> np.ndarray:
        """Fixes the average color of the input image"""

        if scale_factor != 100.0:
            # Make sure reference image dims are not resized to 0
            h, w, _ = get_h_w_c(ref_img)
            out_dims = (
                max(ceil(w * (scale_factor / 100)), 1),
                max(ceil(h * (scale_factor / 100)), 1),
            )

            ref_img = cv2.resize(
                ref_img,
                out_dims,
                interpolation=cv2.INTER_AREA,
            )

        input_h, input_w, input_c = get_h_w_c(input_img)
        ref_h, ref_w, ref_c = get_h_w_c(ref_img)

        assert (
            ref_w < input_w and ref_h < input_h
        ), "Image must be larger than Reference Image"
        assert input_c in (3, 4), "The input image must be an RGB or RGBA image"
        assert ref_c in (3, 4), "The reference image must be an RGB or RGBA image"

        # adjust channels
        alpha = None
        if input_c > ref_c:
            alpha = input_img[:, :, 3:4]
            input_img = input_img[:, :, :ref_c]
        elif ref_c > input_c:
            ref_img = ref_img[:, :, :input_c]

        # Find the diff of both images

        # Downscale the input image
        downscaled_input = cv2.resize(
            input_img,
            (ref_w, ref_h),
            interpolation=cv2.INTER_AREA,
        )

        # Get difference between the reference image and downscaled input
        downscaled_diff = ref_img - downscaled_input  # type: ignore

        # Upsample the difference
        diff = cv2.resize(
            downscaled_diff,
            (input_w, input_h),
            interpolation=cv2.INTER_CUBIC,
        )

        result = input_img + diff

        # add alpha back in
        if alpha is not None:
            result = np.concatenate([result, alpha], axis=2)

        return np.clip(result, 0, 1)
