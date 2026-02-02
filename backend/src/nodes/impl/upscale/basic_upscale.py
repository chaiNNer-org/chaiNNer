import math
from dataclasses import dataclass
from enum import Enum

import numpy as np

from nodes.impl.image_op import ImageOp
from nodes.impl.image_utils import BorderType, create_border
from nodes.impl.resize import ResizeFilter, resize
from nodes.utils.utils import Padding, get_h_w_c

from .convenient_upscale import SplitProgress, convenient_upscale


@dataclass
class UpscaleInfo:
    in_nc: int
    out_nc: int
    scale: int

    @property
    def supports_custom_scale(self) -> bool:
        return self.scale != 1 and self.in_nc == self.out_nc


class PaddingType(Enum):
    NONE = 0
    REFLECT_MIRROR = 1
    WRAP = 2
    REPLICATE = 3

    def to_border_type(self) -> BorderType:
        if self == PaddingType.NONE:
            raise ValueError(
                "PaddingType.NONE does not have a corresponding BorderType"
            )
        elif self == PaddingType.REFLECT_MIRROR:
            return BorderType.REFLECT_MIRROR
        elif self == PaddingType.WRAP:
            return BorderType.WRAP
        elif self == PaddingType.REPLICATE:
            return BorderType.REPLICATE

        raise ValueError(f"Unknown padding type: {self}")


PAD_SIZE = 16


def _custom_scale_upscale(
    img: np.ndarray,
    upscale: ImageOp,
    natural_scale: int,
    custom_scale: int,
    separate_alpha: bool,
    split_progress: SplitProgress | None = None,
) -> np.ndarray:
    if custom_scale == natural_scale:
        return upscale(img)

    # number of iterations we need to do to reach the desired scale
    # e.g. if the model is 2x and the desired scale is 13x, we need to do 4 iterations
    iterations = max(1, math.ceil(math.log(custom_scale, natural_scale)))
    org_h, org_w, _ = get_h_w_c(img)
    for i in range(iterations):
        # Split progress evenly across iterations
        if split_progress:
            split_progress.focus(i / iterations, 1 / iterations)
        img = upscale(img)

    # resize, if necessary
    target_size = (
        org_w * custom_scale,
        org_h * custom_scale,
    )
    h, w, _ = get_h_w_c(img)
    if (w, h) != target_size:
        img = resize(
            img,
            target_size,
            ResizeFilter.BOX,
            separate_alpha=separate_alpha,
        )

    return img


def basic_upscale(
    img: np.ndarray,
    upscale: ImageOp,
    upscale_info: UpscaleInfo,
    scale: int,
    separate_alpha: bool,
    padding: PaddingType = PaddingType.NONE,
    clip: bool = True,
    split_progress: SplitProgress | None = None,
):
    def inner_upscale(img: np.ndarray) -> np.ndarray:
        return convenient_upscale(
            img,
            upscale_info.in_nc,
            upscale_info.out_nc,
            upscale,
            separate_alpha,
            clip=clip,
            split_progress=split_progress,
        )

    if not upscale_info.supports_custom_scale and scale != upscale_info.scale:
        raise ValueError(
            f"Upscale info does not support custom scale: {upscale_info}, scale: {scale}"
        )

    if padding != PaddingType.NONE:
        img = create_border(img, padding.to_border_type(), Padding.all(PAD_SIZE))

    img = _custom_scale_upscale(
        img,
        inner_upscale,
        natural_scale=upscale_info.scale,
        custom_scale=scale,
        separate_alpha=separate_alpha,
        split_progress=split_progress,
    )

    if padding != PaddingType.NONE:
        crop = PAD_SIZE * scale
        img = img[crop:-crop, crop:-crop]

    return img
