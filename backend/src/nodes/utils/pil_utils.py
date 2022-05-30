import os
import sys
from typing import Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from PIL.Image import Resampling  # type: ignore
from sanic.log import logger
from .utils import get_h_w_c


class InterpolationMethod:
    AUTO = -1
    NEAREST = 0
    LANCZOS = 1
    LINEAR = 2
    CUBIC = 3
    BOX = 4


try:
    pil = Image

    INTERPOLATION_METHODS_MAP = {
        InterpolationMethod.NEAREST: Resampling.NEAREST,
        InterpolationMethod.BOX: Resampling.BOX,
        InterpolationMethod.LINEAR: Resampling.BILINEAR,
        InterpolationMethod.CUBIC: Resampling.BICUBIC,
        InterpolationMethod.LANCZOS: Resampling.LANCZOS,
    }
except ImportError:
    logger.error("No PIL found, defaulting to cv2 for resizing")
    pil = None

    INTERPOLATION_METHODS_MAP = {
        InterpolationMethod.NEAREST: cv2.INTER_NEAREST,
        InterpolationMethod.BOX: cv2.INTER_AREA,
        InterpolationMethod.LINEAR: cv2.INTER_LINEAR,
        InterpolationMethod.CUBIC: cv2.INTER_CUBIC,
        InterpolationMethod.LANCZOS: cv2.INTER_LANCZOS4,
    }


def resize(
    img: np.ndarray, out_dims: Tuple[int, int], interpolation: int
) -> np.ndarray:
    """Perform PIL resize or fall back to cv2"""

    if interpolation == InterpolationMethod.AUTO:
        # automatically chose a method that works
        new_w, new_h = out_dims
        old_h, old_w, _ = get_h_w_c(img)
        if new_w > old_w or new_h > old_h:
            interpolation = InterpolationMethod.LANCZOS
        else:
            interpolation = InterpolationMethod.BOX

    interpolation = INTERPOLATION_METHODS_MAP[interpolation]

    # Try PIL first, otherwise fall back to cv2
    if pil is not None:
        pimg = pil.fromarray((img * 255).astype("uint8"))
        pimg = pimg.resize(out_dims, resample=interpolation)  # type: ignore
        return np.array(pimg).astype("float32") / 255
    else:
        return cv2.resize(img, out_dims, interpolation=interpolation)


def add_caption(img: np.ndarray, caption: str) -> np.ndarray:
    """Add caption with PIL"""

    img = cv2.copyMakeBorder(img, 0, 42, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0, 1))

    pimg = Image.fromarray((img * 255).astype("uint8"))
    font_path = os.path.join(
        os.path.dirname(sys.modules["__main__"].__file__), "fonts/Roboto-Light.ttf"  # type: ignore
    )
    font = ImageFont.truetype(font_path, 32)
    h, w, _ = get_h_w_c(img)
    text_x = w // 2
    text_y = h - 21

    d = ImageDraw.Draw(pimg)
    d.text((text_x, text_y), caption, font=font, anchor="mm", align="center")

    img = np.array(pimg)

    return img
