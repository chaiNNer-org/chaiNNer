from __future__ import annotations

from enum import Enum

import numpy as np
from nodes.impl.pil_utils import InterpolationMethod, resize
from nodes.properties.inputs import (
    EnumInput,
    ImageInput,
    InterpolationInput,
    NumberInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c, round_half_up
from sanic.log import logger

from .. import resize_group


class SideSelection(Enum):
    WIDTH = "width"
    HEIGHT = "height"
    SHORTER_SIDE = "shorter side"
    LONGER_SIDE = "longer side"


class ResizeCondition(Enum):
    BOTH = "both"
    UPSCALE = "upscale"
    DOWNSCALE = "downscale"


def resize_to_side_conditional(
    w: int, h: int, target: int, side: SideSelection, condition: ResizeCondition
) -> tuple[int, int]:
    def compare_conditions(b: int) -> bool:
        if condition == ResizeCondition.BOTH:
            return False
        if condition == ResizeCondition.DOWNSCALE:
            return target > b
        elif condition == ResizeCondition.UPSCALE:
            return target < b
        else:
            raise RuntimeError(f"Unknown condition {condition}")

    if side == SideSelection.WIDTH:
        if compare_conditions(w):
            w_new = w
            h_new = h
        else:
            w_new = target
            h_new = max(round_half_up((target / w) * h), 1)

    elif side == SideSelection.HEIGHT:
        if compare_conditions(h):
            w_new = w
            h_new = h
        else:
            w_new = max(round_half_up((target / h) * w), 1)
            h_new = target

    elif side == SideSelection.SHORTER_SIDE:
        if compare_conditions(min(h, w)):
            w_new = w
            h_new = h
        else:
            w_new = max(round_half_up((target / min(h, w)) * w), 1)
            h_new = max(round_half_up((target / min(h, w)) * h), 1)

    elif side == SideSelection.LONGER_SIDE:
        if compare_conditions(max(h, w)):
            w_new = w
            h_new = h
        else:
            w_new = max(round_half_up((target / max(h, w)) * w), 1)
            h_new = max(round_half_up((target / max(h, w)) * h), 1)

    else:
        raise RuntimeError(f"Unknown side selection {side}")

    return w_new, h_new


@resize_group.register(
    schema_id="chainner:image:resize_to_side",
    name="Resize To Side",
    description=(
        "Resize an image to a given side length while keeping aspect ratio. "
        "Auto uses box for downsampling and lanczos for upsampling."
    ),
    icon="MdOutlinePhotoSizeSelectLarge",
    inputs=[
        ImageInput(),
        NumberInput(
            "Size Target",
            default=2160,
            minimum=1,
            unit="px",
        ),
        EnumInput(SideSelection, label="Resize To"),
        InterpolationInput(),
        EnumInput(
            ResizeCondition,
            option_labels={
                ResizeCondition.BOTH: "Upscale And Downscale",
                ResizeCondition.UPSCALE: "Upscale Only",
                ResizeCondition.DOWNSCALE: "Downscale Only",
            },
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                struct Size { width: uint, height: uint }

                let w = Input0.width;
                let h = Input0.height;
                let target = Input1;
                let side = Input2;
                let condition = Input4;

                def compareCondition(b: uint): bool {
                    match condition {
                        ResizeCondition::Both => false,
                        ResizeCondition::Downscale => target > b,
                        ResizeCondition::Upscale => target < b
                    }
                }

                let same = Size { width: w, height: h };

                let outSize = match side {
                    SideSelection::Width => if compareCondition(w) { same } else {
                        Size {
                            width: target,
                            height: max(round((target / w) * h), 1)
                        }
                    },
                    SideSelection::Height => if compareCondition(h) { same } else {
                        Size {
                            width: max(round((target / h) * w), 1),
                            height: target
                        }
                    },
                    SideSelection::ShorterSide => if compareCondition(min(h, w)) { same } else {
                        Size {
                            width: max(round((target / min(h, w)) * w), 1),
                            height: max(round((target / min(h, w)) * h), 1)
                        }
                    },
                    SideSelection::LongerSide => if compareCondition(max(h, w)) { same } else {
                        Size {
                            width: max(round((target / max(h, w)) * w), 1),
                            height: max(round((target / max(h, w)) * h), 1)
                        }
                    },
                };

                Image {
                    width: outSize.width,
                    height: outSize.height,
                    channels: Input0.channels
                }
                """,
            assume_normalized=True,
        )
    ],
    limited_to_8bpc=True,
)
def resize_to_side_node(
    img: np.ndarray,
    target: int,
    side: SideSelection,
    interpolation: InterpolationMethod,
    condition: ResizeCondition,
) -> np.ndarray:
    """Takes an image and resizes it"""

    logger.debug(f"Resizing image to {side} via {interpolation}")

    h, w, _ = get_h_w_c(img)
    out_dims = resize_to_side_conditional(w, h, target, side, condition)

    return resize(img, out_dims, interpolation)
