from __future__ import annotations

import os
import sys
from typing import Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .image_utils import FillColor, convert_to_BGRA, get_fill_color
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


def get_pil_image_mode(img: np.ndarray) -> str | None:
    if get_h_w_c(img)[2] == 4:
        return "RGBa"  # Pre-multiplied alpha to preserve transparent colors
    else:
        return None


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

    pimg = Image.fromarray((img * 255).astype("uint8"), get_pil_image_mode(img))
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

    pimg = Image.fromarray((img * 255).astype("uint8"), get_pil_image_mode(img))
    pimg = pimg.rotate(angle, interpolation, expand, fillcolor=fill_color)  # type: ignore
    return np.array(pimg).astype("float32") / 255


def add_caption(img: np.ndarray, caption: str, size: int, position: str) -> np.ndarray:
    """Add caption with PIL"""
    fontsize = round(size * 0.8)
    if position == "bottom":
        img = cv2.copyMakeBorder(
            img, 0, size, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0, 1)
        )
    elif position == "top":
        img = cv2.copyMakeBorder(
            img, size, 0, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0, 1)
        )
    else:
        raise RuntimeError(f"Unknown position {position}")

    pimg = Image.fromarray((img * 255).astype("uint8"))
    font_path = os.path.join(
        os.path.dirname(sys.modules["__main__"].__file__), "fonts/Roboto-Light.ttf"  # type: ignore
    )
    font = ImageFont.truetype(font_path, fontsize)
    h, w, c = get_h_w_c(img)
    text_x = w // 2
    if position == "bottom":
        text_y = h - round(size / 2)
    elif position == "top":
        text_y = round(size / 2)
    font_color = (255,) * c

    fw, _ = font.getsize(caption)
    # scale font size to fit image
    if fw > w:
        font = ImageFont.truetype(font_path, round(fontsize * w / fw))

    d = ImageDraw.Draw(pimg)
    d.text(
        (text_x, text_y),
        caption,
        font=font,
        anchor="mm",
        align="center",
        fill=font_color,
    )

    img = np.array(pimg).astype("float32") / 255

    return img
