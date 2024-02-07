from __future__ import annotations

import os
import sys
from enum import Enum

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ..utils.utils import get_h_w_c
from .image_utils import as_target_channels, normalize


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


def get_font(font_size: int):
    font_path = os.path.join(
        os.path.dirname(sys.modules["__main__"].__file__),  # type: ignore
        "fonts/Roboto-Light.ttf",  # type: ignore
    )
    return ImageFont.truetype(font_path, font_size)


def add_caption(
    img: np.ndarray, caption: str, size: int, position: CaptionPosition
) -> np.ndarray:
    """Add caption with PIL"""
    _, w, c = get_h_w_c(img)

    cap_img = Image.fromarray(np.zeros((size, w), dtype=np.uint8))

    font_size = round(size * 0.8)
    font = get_font(font_size)

    fw, _ = get_font_size(font, caption)
    # scale font size to fit image
    if fw > w:
        font = get_font(round(font_size * w / fw))

    d = ImageDraw.Draw(cap_img)
    d.text(
        (w // 2, size // 2),
        caption,
        font=font,
        anchor="mm",
        align="center",
        fill=255,
    )

    cap_img = normalize(np.array(cap_img))
    cap_img = as_target_channels(cap_img, c)

    if position == CaptionPosition.BOTTOM:
        return np.vstack((img, cap_img))
    elif position == CaptionPosition.TOP:
        return np.vstack((cap_img, img))
    else:
        raise ValueError(f"Unknown position {position}")
