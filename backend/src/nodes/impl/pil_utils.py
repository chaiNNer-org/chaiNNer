from __future__ import annotations

from enum import Enum

import numpy as np
from PIL import Image

from ..utils.utils import get_h_w_c
from .image_utils import FillColor, convert_to_bgra, normalize, to_uint8


class InterpolationMethod(Enum):
    AUTO = -1
    NEAREST = 0
    LANCZOS = 1
    LINEAR = 2
    CUBIC = 3
    BOX = 4


class RotationInterpolationMethod(Enum):
    CUBIC = InterpolationMethod.CUBIC.value
    LINEAR = InterpolationMethod.LINEAR.value
    NEAREST = InterpolationMethod.NEAREST.value

    @property
    def interpolation_method(self) -> InterpolationMethod:
        return InterpolationMethod(self.value)


INTERPOLATION_METHODS_MAP = {
    InterpolationMethod.NEAREST: Image.NEAREST,
    InterpolationMethod.BOX: Image.BOX,
    InterpolationMethod.LINEAR: Image.BILINEAR,
    InterpolationMethod.CUBIC: Image.BICUBIC,
    InterpolationMethod.LANCZOS: Image.LANCZOS,
}


class RotateSizeChange(Enum):
    EXPAND = 1
    CROP = 0


def resize(
    img: np.ndarray, out_dims: tuple[int, int], interpolation: InterpolationMethod
) -> np.ndarray:
    """Perform PIL resize"""

    if interpolation == InterpolationMethod.AUTO:
        # automatically chose a method that works
        new_w, new_h = out_dims
        old_h, old_w, _ = get_h_w_c(img)
        if new_w > old_w or new_h > old_h:
            interpolation = InterpolationMethod.LANCZOS
        else:
            interpolation = InterpolationMethod.BOX

    resample = INTERPOLATION_METHODS_MAP[interpolation]

    pimg = Image.fromarray(to_uint8(img, normalized=True))
    pimg = pimg.resize(out_dims, resample=resample)  # type: ignore
    return normalize(np.array(pimg))


def rotate(
    img: np.ndarray,
    angle: float,
    interpolation: RotationInterpolationMethod,
    expand: RotateSizeChange,
    fill: FillColor,
) -> np.ndarray:
    """Perform PIL rotate"""

    c = get_h_w_c(img)[2]
    if fill == FillColor.TRANSPARENT:
        img = convert_to_bgra(img, c)
    fill_color = tuple([x * 255 for x in fill.get_color(c)])

    resample = INTERPOLATION_METHODS_MAP[interpolation.interpolation_method]

    pimg = Image.fromarray(to_uint8(img, normalized=True))
    pimg = pimg.rotate(
        angle,
        resample=resample,  # type: ignore
        expand=bool(expand.value),
        fillcolor=fill_color,  # type: ignore
    )
    return normalize(np.array(pimg))
