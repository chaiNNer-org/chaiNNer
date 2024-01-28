from __future__ import annotations

from math import ceil

import cv2
import numpy as np

from nodes.impl.resize import ResizeFilter, resize
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
)
def average_color_fix_node(
    input_img: np.ndarray, ref_img: np.ndarray, scale_factor: float
) -> np.ndarray:
    if scale_factor != 100.0:
        # Make sure reference image dims are not resized to 0
        h, w, _ = get_h_w_c(ref_img)
        out_dims = (
            max(ceil(w * (scale_factor / 100)), 1),
            max(ceil(h * (scale_factor / 100)), 1),
        )

        ref_img = resize(ref_img, out_dims, filter=ResizeFilter.BOX)

    input_h, input_w, input_c = get_h_w_c(input_img)
    ref_h, ref_w, ref_c = get_h_w_c(ref_img)

    assert (
        ref_w < input_w and ref_h < input_h
    ), "Image must be larger than Reference Image"

    # Find the diff of both images

    # Downscale the input image
    downscaled_input = resize(input_img, (ref_w, ref_h), filter=ResizeFilter.BOX)

    # adjust channels
    alpha = None
    downscaled_alpha = None
    ref_alpha = None
    if input_c > 3:
        alpha = input_img[:, :, 3:4]
        input_img = input_img[:, :, :3]
        downscaled_alpha = downscaled_input[:, :, 3:4]
        downscaled_input = downscaled_input[:, :, :3]
    if ref_c > 3:
        ref_alpha = ref_img[:, :, 3:4]
        ref_img = ref_img[:, :, :3]

    # Get difference between the reference image and downscaled input
    downscaled_diff = ref_img - downscaled_input  # type: ignore

    downscaled_alpha_diff = None
    if ref_alpha is not None or downscaled_alpha is not None:
        # Don't alter RGB pixels if either the input or reference pixel is
        # fully transparent, since RGB diff is indeterminate for those pixels.
        if ref_alpha is not None and downscaled_alpha is not None:
            invalid_alpha_mask = (ref_alpha == 0) | (downscaled_alpha == 0)
        elif ref_alpha is not None:
            invalid_alpha_mask = ref_alpha == 0
        else:
            invalid_alpha_mask = downscaled_alpha == 0
        invalid_alpha_indices = np.nonzero(invalid_alpha_mask)
        downscaled_diff[invalid_alpha_indices] = 0

        if ref_alpha is not None and downscaled_alpha is not None:
            downscaled_alpha_diff = ref_alpha - downscaled_alpha  # type: ignore

    # Upsample the difference
    diff = cv2.resize(
        downscaled_diff,
        (input_w, input_h),
        interpolation=cv2.INTER_CUBIC,
    )

    alpha_diff = None
    if downscaled_alpha_diff is not None:
        alpha_diff = cv2.resize(
            downscaled_alpha_diff,
            (input_w, input_h),
            interpolation=cv2.INTER_CUBIC,
        )
        alpha_diff = np.expand_dims(alpha_diff, 2)

    if alpha_diff is not None:
        # Don't alter alpha pixels if the input pixel is fully transparent, since
        # doing so would expose indeterminate RGB data.
        invalid_rgb_mask = alpha == 0
        invalid_rgb_indices = np.nonzero(invalid_rgb_mask)
        alpha_diff[invalid_rgb_indices] = 0

    result = input_img + diff
    if alpha_diff is not None:
        alpha = alpha + alpha_diff  # type: ignore

    # add alpha back in
    if alpha is not None:
        result = np.concatenate([result, alpha], axis=2)

    return result
