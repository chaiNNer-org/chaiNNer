import sys
from math import ceil, floor
import os
from typing import Tuple
import cv2
import numpy as np
from sanic.log import logger


class InterpolationMethod:
    AUTO = -1
    NEAREST = 0
    LANCZOS = 1
    LINEAR = 2
    CUBIC = 3
    BOX = 4


try:
    from PIL import Image, ImageDraw, ImageFont
    from PIL.Image import Resampling

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
    Resampling = None
    pil = Image = None
    ImageDraw = None
    ImageFont = None

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
        old_h, old_w = img.shape[:2]
        if new_w > old_w or new_h > old_h:
            interpolation = InterpolationMethod.LANCZOS
        else:
            interpolation = InterpolationMethod.BOX

    interpolation = INTERPOLATION_METHODS_MAP[interpolation]

    # Try PIL first, otherwise fall back to cv2
    if pil is not None:
        pimg = pil.fromarray((img * 255).astype("uint8"))
        pimg = pimg.resize(out_dims, resample=interpolation)
        return np.array(pimg).astype("float32") / 255
    else:
        return cv2.resize(img, out_dims, interpolation=interpolation)


def add_caption(img: np.ndarray, caption: str) -> np.ndarray:
    """Add caption with PIL or fall back to cv2"""

    if pil is not None:
        img = cv2.copyMakeBorder(
            img, 0, 42, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0, 1)
        )

        pimg = Image.fromarray((img * 255).astype("uint8"))
        font_path = os.path.join(
            os.path.dirname(sys.modules["__main__"].__file__), "fonts/Roboto-Light.ttf"
        )
        font = ImageFont.truetype(font_path, 32)
        text_x = img.shape[1] // 2
        text_y = img.shape[0] - 21

        d = ImageDraw.Draw(pimg)
        d.text((text_x, text_y), caption, font=font, anchor="mm", align="center")

        img = np.array(pimg)
    else:  # Fall back to cv2 if PIL is not installed
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_size = 1
        font_thickness = 1

        textsize = cv2.getTextSize(caption, font, font_size, font_thickness)
        logger.info(textsize)
        textsize = textsize[0]

        caption_height = textsize[1] + 20

        img = cv2.copyMakeBorder(
            img, 0, caption_height, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0, 1)
        )

        text_x = floor((img.shape[1] - textsize[0]) / 2)
        text_y = ceil(img.shape[0] - ((caption_height - textsize[1]) / 2))

        cv2.putText(
            img,
            caption,
            (text_x, text_y),
            font,
            font_size,
            color=(255, 255, 255, 255),
            thickness=font_thickness,
            lineType=cv2.LINE_AA,
        )

    return img
