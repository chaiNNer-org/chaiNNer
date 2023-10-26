from __future__ import annotations

import os
import sys
from enum import Enum

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ..utils.utils import get_h_w_c
from .image_utils import normalize, to_uint8


class CaptionPosition(Enum):
    BOTTOM = "bottom"
    TOP = "top"


def get_font_size(font: ImageFont.FreeTypeFont, text: str) -> tuple[int, int]:
    """Get font [width, height] of the given text"""
    # (left, top, right, bottom)
    caption_bb = font.getbbox(text)
    font_width = caption_bb[2] - caption_bb[0]
    font_height = caption_bb[3] - caption_bb[1]
    return font_width, font_height


def add_caption(
    img: np.ndarray, caption: str, size: int, position: CaptionPosition
) -> np.ndarray:
    """Add caption with PIL"""
    fontsize = round(size * 0.8)
    if position is CaptionPosition.BOTTOM:
        img = cv2.copyMakeBorder(
            img, 0, size, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0, 1)
        )
    elif position is CaptionPosition.TOP:
        img = cv2.copyMakeBorder(
            img, size, 0, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0, 1)
        )
    else:
        raise RuntimeError(f"Unknown position {position}")

    pimg = Image.fromarray(to_uint8(img))
    font_path = os.path.join(
        os.path.dirname(sys.modules["__main__"].__file__), "fonts/Roboto-Light.ttf"  # type: ignore
    )
    font = ImageFont.truetype(font_path, fontsize)
    h, w, c = get_h_w_c(img)
    text_x = w // 2
    if position is CaptionPosition.BOTTOM:
        text_y = h - round(size / 2)
    elif position is CaptionPosition.TOP:
        text_y = round(size / 2)
    font_color = (255,) * c

    fw, _ = get_font_size(font, caption)
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

    img = normalize(np.array(pimg))

    return img
