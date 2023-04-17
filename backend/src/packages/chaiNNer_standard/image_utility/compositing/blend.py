from __future__ import annotations

import cv2
import numpy as np

from nodes.impl.blend import BlendMode, blend_images
from nodes.impl.color.color import Color
from nodes.impl.image_utils import as_2d_grayscale
from nodes.impl.pil_utils import convert_to_BGRA
from nodes.properties.inputs import BlendModeDropdown, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import compositing_group


@compositing_group.register(
    schema_id="chainner:image:blend",
    name="Blend Images",
    description="""Blends overlay image onto base image using specified mode.""",
    icon="BsLayersHalf",
    inputs=[
        ImageInput("Base Layer", channels=[1, 3, 4], allow_colors=True),
        ImageInput("Overlay Layer", channels=[1, 3, 4], allow_colors=True),
        BlendModeDropdown(),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def getWidth(i: any) = match i { Image => i.width, _ => -inf };
                def getHeight(i: any) = match i { Image => i.height, _ => -inf };

                Image {
                    width: max(getWidth(Input0), getWidth(Input1)) & uint,
                    height: max(getHeight(Input0), getHeight(Input1)) & uint,
                    channels: max(Input0.channels, Input1.channels),
                }
            """,
            assume_normalized=True,
        ).with_never_reason("At least one layer must be an image"),
    ],
)
def blend_node(
    base: np.ndarray | Color,
    ov: np.ndarray | Color,
    blend_mode: BlendMode,
) -> np.ndarray:
    """Blend images together"""

    # convert colors to images
    if isinstance(base, Color):
        if isinstance(ov, Color):
            raise ValueError("At least one layer must be an image")
        base = base.to_image(width=ov.shape[1], height=ov.shape[0])
    if isinstance(ov, Color):
        ov = ov.to_image(width=base.shape[1], height=base.shape[0])

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
        assert isinstance(base, np.ndarray)
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
