import os
import sys
from typing import Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .image_utils import convert_to_BGRA
from .utils import get_h_w_c


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


class RotateFillColor:
    AUTO = -1
    BLACK = 0
    TRANSPARENT = 1


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

    # Select how to fill negative space that results from rotation
    c = get_h_w_c(img)[2]
    if fill == RotateFillColor.AUTO:
        fill_color = (0,) * c
    elif fill == RotateFillColor.BLACK:
        fill_color = (0,) * c if c < 4 else (0, 0, 0, 255)
    else:
        img = convert_to_BGRA(img, c)
        fill_color = (0, 0, 0, 0)

    interpolation = INTERPOLATION_METHODS_MAP[interpolation]

    pimg = Image.fromarray((img * 255).astype("uint8"))
    pimg = pimg.rotate(angle, interpolation, expand, fillcolor=fill_color)  # type: ignore
    return np.array(pimg).astype("float32") / 255


def add_caption(img: np.ndarray, caption: str) -> np.ndarray:
    """Add caption with PIL"""

    img = cv2.copyMakeBorder(img, 0, 42, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0, 1))

    pimg = Image.fromarray((img * 255).astype("uint8"))
    font_path = os.path.join(
        os.path.dirname(sys.modules["__main__"].__file__), "fonts/Roboto-Light.ttf"  # type: ignore
    )
    font = ImageFont.truetype(font_path, 32)
    h, w, c = get_h_w_c(img)
    text_x = w // 2
    text_y = h - 21
    font_color = (255,) * c

    d = ImageDraw.Draw(pimg)
    d.text(
        (text_x, text_y),
        caption,
        font=font,
        anchor="mm",
        align="center",
        fill=font_color,
    )

    img = np.array(pimg)

    return img
