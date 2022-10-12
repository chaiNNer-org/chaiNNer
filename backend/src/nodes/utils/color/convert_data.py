from typing import List
import numpy as np
import cv2

from .convert_model import ColorSpace, Conversion
from ..utils import get_h_w_c


GRAY = ColorSpace(0, "Gray", 1)
RGB = ColorSpace(1, "RGB", 3)
RGBA = ColorSpace(2, "RGBA", 4)
YUV = ColorSpace(3, "YUV", 3)
HSV = ColorSpace(4, "HSV", 3)

color_spaces = [RGB, RGBA, GRAY, YUV, HSV]


def __rev3(image: np.ndarray) -> np.ndarray:
    c = get_h_w_c(image)[2]
    assert c == 3, "Expected a 3-channel image"
    return np.stack([image[:, :, 2], image[:, :, 1], image[:, :, 0]], axis=2)


def __rgb_to_hsv(img: np.ndarray) -> np.ndarray:
    img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    img[:, :, 0] /= 360  # type: ignore
    return __rev3(img)


def __hsv_to_rgb(img: np.ndarray) -> np.ndarray:
    img = __rev3(img)
    img[:, :, 0] *= 360
    return cv2.cvtColor(img, cv2.COLOR_HSV2BGR)


# The conversion loses one channel of information (e.g. the alpha channel, or a color channel)
__CHANNEL_LOST = 1000
# The conversion loses hue/chroma information in certain edge cases
__CHROMA_LOST = 100


conversions: List[Conversion] = [
    # RGB and grayscale
    Conversion(
        direction=(RGB, GRAY),
        convert=lambda i: cv2.cvtColor(i, cv2.COLOR_BGR2GRAY),
        cost=__CHANNEL_LOST * 2,
    ),
    Conversion(
        direction=(GRAY, RGB),
        convert=lambda i: cv2.cvtColor(i, cv2.COLOR_GRAY2BGR),
    ),
    Conversion(
        direction=(RGB, RGBA),
        convert=lambda i: cv2.cvtColor(i, cv2.COLOR_BGR2BGRA),
    ),
    Conversion(
        direction=(RGBA, RGB),
        convert=lambda i: cv2.cvtColor(i, cv2.COLOR_BGRA2BGR),
        cost=__CHANNEL_LOST,
    ),
    Conversion(
        direction=(RGBA, GRAY),
        convert=lambda i: cv2.cvtColor(i, cv2.COLOR_BGRA2GRAY),
        cost=__CHANNEL_LOST * 3,
    ),
    Conversion(
        direction=(GRAY, RGBA),
        convert=lambda i: cv2.cvtColor(i, cv2.COLOR_GRAY2BGRA),
    ),
    # YUV
    Conversion(
        direction=(RGB, YUV),
        convert=lambda i: __rev3(cv2.cvtColor(i, cv2.COLOR_BGR2YUV)),
    ),
    Conversion(
        direction=(YUV, RGB),
        convert=lambda i: cv2.cvtColor(__rev3(i), cv2.COLOR_YUV2BGR),
        cost=__CHROMA_LOST,
    ),
    # HSV
    Conversion(
        direction=(RGB, HSV),
        convert=__rgb_to_hsv,
    ),
    Conversion(
        direction=(HSV, RGB),
        convert=__hsv_to_rgb,
        cost=__CHROMA_LOST,
    ),
]
