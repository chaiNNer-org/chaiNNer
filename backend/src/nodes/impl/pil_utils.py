from typing import Tuple

import numpy as np
from PIL import Image

from .image_utils import FillColor, convert_to_BGRA, get_fill_color
from ..utils.utils import get_h_w_c


class InterpolationMethod:
    AUTO = -1
    NEAREST = 0
    LANCZOS = 1
    LINEAR = 2
    CUBIC = 3
    BOX = 4


INTERPOLATION_METHODS_MAP = {
    InterpolationMethod.NEAREST: Image.NEAREST,
    InterpolationMethod.BOX: Image.BOX,
    InterpolationMethod.LINEAR: Image.BILINEAR,
    InterpolationMethod.CUBIC: Image.BICUBIC,
    InterpolationMethod.LANCZOS: Image.LANCZOS,
}


class RotateExpandCrop:
    EXPAND = 1
    CROP = 0


def resize(
    img: np.ndarray, out_dims: Tuple[int, int], interpolation: int
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

    interpolation = INTERPOLATION_METHODS_MAP[interpolation]

    pimg = Image.fromarray((img * 255).astype("uint8"))
    pimg = pimg.resize(out_dims, resample=interpolation)  # type: ignore
    return np.array(pimg).astype("float32") / 255


def rotate(
    img: np.ndarray, angle: float, interpolation: int, expand: int, fill: int
) -> np.ndarray:
    """Perform PIL rotate"""

    c = get_h_w_c(img)[2]
    if fill == FillColor.TRANSPARENT:
        img = convert_to_BGRA(img, c)
    fill_color = tuple([x * 255 for x in get_fill_color(c, fill)])

    interpolation = INTERPOLATION_METHODS_MAP[interpolation]

    pimg = Image.fromarray((img * 255).astype("uint8"))
    pimg = pimg.rotate(angle, interpolation, expand, fillcolor=fill_color)  # type: ignore
    return np.array(pimg).astype("float32") / 255
