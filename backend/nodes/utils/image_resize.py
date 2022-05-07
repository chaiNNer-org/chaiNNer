from typing import Tuple
import cv2
import numpy as np
from sanic.log import logger


class InterpolationMethod:
    NEAREST = 0
    LANCZOS = 1
    LINEAR = 2
    CUBIC = 3
    BOX = 4


try:
    from PIL import Image
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

    INTERPOLATION_METHODS_MAP = {
        InterpolationMethod.NEAREST: cv2.INTER_NEAREST,
        InterpolationMethod.BOX: cv2.INTER_AREA,
        InterpolationMethod.LINEAR: cv2.INTER_LINEAR,
        InterpolationMethod.CUBIC: cv2.INTER_CUBIC,
        InterpolationMethod.LANCZOS: cv2.INTER_LANCZOS4,
    }


def resize(img: np.ndarray, out_dims: Tuple[int, int], interpolation: int):
    interpolation = INTERPOLATION_METHODS_MAP[interpolation]

    # Try PIL first, otherwise fall back to cv2
    if pil is not None:
        pimg = pil.fromarray((img * 255).astype("uint8"))
        pimg = pimg.resize(out_dims, resample=interpolation)
        return np.array(pimg).astype("float32") / 255
    else:
        return cv2.resize(img, out_dims, interpolation=interpolation)
