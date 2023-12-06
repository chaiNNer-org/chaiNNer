from __future__ import annotations

import cv2
import numpy as np

from nodes.impl.diff import diff_images, sum_images
from nodes.impl.pil_utils import InterpolationMethod, resize
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import compositing_group


@compositing_group.register(
    schema_id="chainner:image:diff",
    name="Add Image Diff",
    description="""Subtracts two reference images, and adds the diff to an input image.""",
    icon="BsLayersHalf",
    inputs=[
        ImageInput("Image", channels=[3, 4]),
        ImageInput("Reference Init", channels=[3, 4]),
        ImageInput("Reference Goal", channels=[3, 4]),
    ],
    outputs=[ImageOutput(image_type="Input0")],
    limited_to_8bpc=True,
)
def add_image_diff_node(
    input_img: np.ndarray,
    ref_init_img: np.ndarray,
    ref_goal_img: np.ndarray,
) -> np.ndarray:
    """Subtract two images, and add result to another image"""

    diff = diff_images(ref_goal_img, ref_init_img)

    result = sum_images(input_img, diff)

    # Handle pixels that are fully transparent in input image but not goal image.
    result_h, result_w, result_c = get_h_w_c(result)
    ref_goal_h, ref_goal_w, ref_goal_c = get_h_w_c(ref_goal_img)
    if result_c > 3 and ref_goal_c > 3:
        if result_h != ref_goal_h or result_w != ref_goal_w:
            # Scale the goal image to match input image.
            ref_goal_img = resize(
                ref_goal_img,
                (result_w, result_h),
                interpolation=InterpolationMethod.CUBIC,
            )

        # split channels
        result_b, result_g, result_r, result_alpha = cv2.split(result)
        ref_goal_b, ref_goal_g, ref_goal_r, ref_goal_alpha = cv2.split(ref_goal_img)

        # For pixels that are fully transparent in input image, pass-through the goal pixel.
        invalid_mask = result_alpha <= 0 # type: ignore
        invalid_indices = np.nonzero(invalid_mask)
        result_b[invalid_indices] = ref_goal_b[invalid_indices]
        result_g[invalid_indices] = ref_goal_g[invalid_indices]
        result_r[invalid_indices] = ref_goal_r[invalid_indices]
        result_alpha[invalid_indices] = ref_goal_alpha[invalid_indices]

        # merge channels
        result = cv2.merge([result_b, result_g, result_r, result_alpha])

    return result
