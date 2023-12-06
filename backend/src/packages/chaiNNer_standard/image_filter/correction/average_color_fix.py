from __future__ import annotations

from math import ceil

import numpy as np

from nodes.impl.diff import diff_images, sum_images
from nodes.impl.pil_utils import InterpolationMethod, resize
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import correction_group


@correction_group.register(
    schema_id="chainner:image:average_color_fix",
    name="Average Color Fix",
    description="""Correct for upscaling model color shift by matching
         the average color of the Input Image to that of a smaller Reference Image.
         Using significant downscaling increases generalization of averaging effect
         and can reduce artifacts in the output.""",
    icon="MdAutoFixHigh",
    inputs=[
        ImageInput("Image", channels=[3, 4]),
        ImageInput("Reference Image", channels=[3, 4]),
        NumberInput(
            "Reference Image Scale Factor",
            precision=4,
            controls_step=12.5,
            maximum=100.0,
            default=12.5,
            unit="%",
        ),
    ],
    outputs=[ImageOutput(image_type="Input0")],
    limited_to_8bpc=True,
)
def average_color_fix_node(
    input_img: np.ndarray, ref_img: np.ndarray, scale_factor: float
) -> np.ndarray:
    """Fixes the average color of the input image"""

    if scale_factor != 100.0:
        # Make sure reference image dims are not resized to 0
        h, w, _ = get_h_w_c(ref_img)
        out_dims = (
            max(ceil(w * (scale_factor / 100)), 1),
            max(ceil(h * (scale_factor / 100)), 1),
        )

        ref_img = resize(
            ref_img,
            out_dims,
            interpolation=InterpolationMethod.BOX,
        )

    input_h, input_w, input_c = get_h_w_c(input_img)
    ref_h, ref_w, ref_c = get_h_w_c(ref_img)

    assert (
        ref_w < input_w and ref_h < input_h
    ), "Image must be larger than Reference Image"

    # Find the diff of both images

    # Downscale the input image
    downscaled_input = resize(
        input_img,
        (ref_w, ref_h),
        interpolation=InterpolationMethod.BOX,
    )

    # Get difference between the reference image and downscaled input
    downscaled_diff = diff_images(ref_img, downscaled_input)

    # Add the difference to the input image
    result = sum_images(input_img, downscaled_diff)

    return result
