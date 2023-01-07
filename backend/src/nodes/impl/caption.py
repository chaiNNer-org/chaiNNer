from enum import Enum
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ..utils.utils import get_h_w_c


class CaptionPosition(Enum):
    BOTTOM = "bottom"
    TOP = "top"


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

    pimg = Image.fromarray((img * 255).astype("uint8"))
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
