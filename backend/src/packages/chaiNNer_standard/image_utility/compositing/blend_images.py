from __future__ import annotations

from enum import Enum

import cv2
import numpy as np
from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.blend import BlendMode, blend_images
from nodes.impl.color.color import Color
from nodes.impl.image_utils import as_2d_grayscale
from nodes.impl.pil_utils import convert_to_BGRA
from nodes.properties.inputs import (
    BlendModeDropdown,
    BoolInput,
    EnumInput,
    ImageInput,
    NumberInput,
    SliderInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import compositing_group


class BlendOverlayPosition(Enum):
    TOP_LEFT = "top_left"
    TOP_CENTERED = "top_centered"
    TOP_RIGHT = "top_right"
    CENTERED_LEFT = "centered_left"
    CENTERED = "centered"
    CENTERED_RIGHT = "centered_right"
    BOTTOM_LEFT = "bottom_left"
    BOTTOM_CENTERED = "bottom_centered"
    BOTTOM_RIGHT = "bottom_right"
    PERCENT_OFFSET = "percent_offset"
    PIXEL_OFFSET = "pixel_offset"


BLEND_OVERLAY_POSITION_LABELS = {
    BlendOverlayPosition.TOP_LEFT: "Top left",
    BlendOverlayPosition.TOP_CENTERED: "Top centered",
    BlendOverlayPosition.TOP_RIGHT: "Top right",
    BlendOverlayPosition.CENTERED_LEFT: "Centered left",
    BlendOverlayPosition.CENTERED: "Centered",
    BlendOverlayPosition.CENTERED_RIGHT: "Centered right",
    BlendOverlayPosition.BOTTOM_LEFT: "Bottom left",
    BlendOverlayPosition.BOTTOM_CENTERED: "Bottom centered",
    BlendOverlayPosition.BOTTOM_RIGHT: "Bottom right",
    BlendOverlayPosition.PERCENT_OFFSET: "Offset (%)",
    BlendOverlayPosition.PIXEL_OFFSET: "Offset (pixels)",
}

BLEND_OVERLAY_X0_Y0_FACTORS = {
    BlendOverlayPosition.TOP_LEFT: np.array([0, 0]),
    BlendOverlayPosition.TOP_CENTERED: np.array([0.5, 0]),
    BlendOverlayPosition.TOP_RIGHT: np.array([1, 0]),
    BlendOverlayPosition.CENTERED_LEFT: np.array([0, 0.5]),
    BlendOverlayPosition.CENTERED: np.array([0.5, 0.5]),
    BlendOverlayPosition.CENTERED_RIGHT: np.array([1, 0.5]),
    BlendOverlayPosition.BOTTOM_LEFT: np.array([0, 1]),
    BlendOverlayPosition.BOTTOM_CENTERED: np.array([0.5, 1]),
    BlendOverlayPosition.BOTTOM_RIGHT: np.array([1, 1]),
    BlendOverlayPosition.PERCENT_OFFSET: np.array([1, 1]),
    BlendOverlayPosition.PIXEL_OFFSET: np.array([0, 0]),
}


@compositing_group.register(
    schema_id="chainner:image:blend",
    name="Blend Images",
    description="""Blends an overlay image onto a base image using the specified mode.""",
    icon="BsLayersHalf",
    inputs=[
        ImageInput("Base Layer", channels=[1, 3, 4], allow_colors=True),
        ImageInput("Overlay Layer", channels=[1, 3, 4], allow_colors=True),
        BlendModeDropdown(),
        if_group(Condition.type(0, "Image") & Condition.type(1, "Image"))(
            EnumInput(
                BlendOverlayPosition,
                label="Overlay position",
                option_labels=BLEND_OVERLAY_POSITION_LABELS,
                default=BlendOverlayPosition.CENTERED,
            ),
            if_enum_group(3, (BlendOverlayPosition.PERCENT_OFFSET))(
                SliderInput(
                    "X offset",
                    precision=0,
                    controls_step=1,
                    minimum=-200,
                    maximum=200,
                    default=0,
                    unit="%",
                ),
                SliderInput(
                    "Y offset",
                    precision=0,
                    controls_step=1,
                    minimum=-200,
                    maximum=200,
                    default=0,
                    unit="%",
                ),
            ),
            if_enum_group(3, (BlendOverlayPosition.PIXEL_OFFSET))(
                NumberInput(
                    "X offset",
                    controls_step=1,
                    minimum=None,
                    maximum=None,
                    default=0,
                    unit="px",
                ),
                NumberInput(
                    "Y offset",
                    controls_step=1,
                    minimum=None,
                    maximum=None,
                    default=0,
                    unit="px",
                ),
            ),
            BoolInput("Crop to fit base layer", default=False),
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
            let base = Input0;
            let overlay = Input1;
            let position:BlendOverlayPosition = Input3;
            let cropToFit = bool::and(bothImages, Input8);

            def isImage(x: any) = match x { Image => true, _ => false };
            let bothImages = bool::and(isImage(base), isImage(overlay));

            def getWidth(img: any) = match img { Image => img.width, _ => -inf };
            def getHeight(img: any) = match img { Image => img.height, _ => -inf };

            struct Size { width: uint, height: uint}
            def imageToSize(x: any): Size = Size {
                width: getWidth(x) & uint,
                height: getHeight(x) & uint
            };
            let baseSize:Size = imageToSize(Input0);
            let overlaySize:Size = imageToSize(Input1);
            let maxSize:Size = Size {
                width: max(getWidth(Input0), getWidth(Input1)) & uint,
                height: max(getHeight(Input0), getHeight(Input1)) & uint,
            };

            def getExtendedDim(base_dim: uint, ov_dim: uint, offset: int): uint {
                abs(min(offset, 0)) + max(base_dim, (offset + ov_dim))
            }
            def getExtendedCanvasSize(b: Size, o: Size, x_offset: int, y_offset: int): Size {
                Size {
                    width: getExtendedDim(b.width, o.width, x_offset),
                    height: getExtendedDim(b.height, o.height, y_offset),
                }
            }
            def percentToOffset(b: uint, o: uint, percent: int): int {
                round(((b - o) * percent / 100.0)) & int
            }
            let extendedCanvasSize = match position {
                BlendOverlayPosition::PercentOffset => getExtendedCanvasSize(
                    baseSize,
                    overlaySize,
                    percentToOffset(baseSize.width, overlaySize.width, Input4),
                    percentToOffset(baseSize.height, overlaySize.height, Input5),
                ),
                BlendOverlayPosition::PixelOffset => getExtendedCanvasSize(
                    baseSize, overlaySize, Input6, Input7
                ),
                _ => maxSize
            };

            let canvasSize = if cropToFit {
                baseSize
            } else {
                if bothImages {extendedCanvasSize} else {maxSize}
            };

            Image {
                width: canvasSize.width & uint,
                height: canvasSize.height & uint,
                channels: max(base.channels, overlay.channels)
            }
            """,
            assume_normalized=True,
        ).with_never_reason("At least one layer must be an image"),
    ],
)
def blend_images_node(
    base: np.ndarray | Color,
    ov: np.ndarray | Color,
    blend_mode: BlendMode,
    overlay_position: BlendOverlayPosition,
    x_percent: int,
    y_percent: int,
    x_px: int,
    y_px: int,
    crop_to_fit: bool,
) -> np.ndarray:
    """Blend images together"""

    # Convert colors to images
    do_crop_to_fit = crop_to_fit
    if isinstance(base, Color):
        if isinstance(ov, Color):
            raise ValueError("At least one layer must be an image")
        base = base.to_image(width=ov.shape[1], height=ov.shape[0])
        do_crop_to_fit = False
    if isinstance(ov, Color):
        ov = ov.to_image(width=base.shape[1], height=base.shape[0])
        do_crop_to_fit = False

    base_height, base_width, base_channel_count = get_h_w_c(base)
    overlay_height, overlay_width, _ = get_h_w_c(ov)

    # Calculate coordinates of the overlay layer
    #   origin: top-let point of the base layer
    #   (x0, y0): top-left point of the overlay layer
    #   (x1, y1): bottom-right point of the overlay layer
    if overlay_position == BlendOverlayPosition.PERCENT_OFFSET:
        x0, y0 = [
            round((base_width - overlay_width) * x_percent / 100),
            round((base_height - overlay_height) * y_percent / 100),
        ]
    elif overlay_position == BlendOverlayPosition.PIXEL_OFFSET:
        x0, y0 = [x_px, y_px]
    else:
        x0, y0 = np.array(
            [base_width - overlay_width, base_height - overlay_height]
            * BLEND_OVERLAY_X0_Y0_FACTORS[overlay_position]
        ).astype("int")
    x1, y1 = x0 + overlay_width, y0 + overlay_height

    # Add borders to the base layer
    top = bottom = left = right = 0
    if not do_crop_to_fit:
        left, right = abs(min(x0, 0)), max(0, (x1 - base_width))
        top, bottom = abs(min(y0, 0)), max(0, (y1 - base_height))

    if any((top, bottom, left, right)):
        # copyMakeBorder will create black border if base not converted to RGBA first
        base = convert_to_BGRA(base, base_channel_count)
        base = cv2.copyMakeBorder(
            base, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(0.0,)
        )
        assert isinstance(base, np.ndarray)
    else:  # Make sure cached image not being worked on regardless
        base = base.copy()

    # Coordinates of the intersection area
    if do_crop_to_fit:
        i_x0, i_x1 = max(0, x0), min(x1, base_width)
        i_y0, i_y1 = max(0, y0), min(y1, base_height)
        if not (0 <= i_x0 < i_x1 and 0 <= i_y0 < i_y1):
            return base

        ov_x0 = max(0, -1 * x0)
        ov_x1 = ov_x0 + i_x1 - i_x0
        ov_y0 = max(0, -1 * y0)
        ov_y1 = ov_y0 + i_y1 - i_y0
        # Crop overlay
        ov = ov[
            ov_y0:ov_y1,
            ov_x0:ov_x1,
        ]
    else:
        i_x0, i_x1 = x0 + left, x1 + left
        i_y0, i_y1 = y0 + top, y1 + top

    # Blend layers
    blended_img = blend_images(
        ov,
        base[i_y0:i_y1, i_x0:i_x1],
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
    result[i_y0:i_y1, i_x0:i_x1] = blended_img
    return result
