from typing import List, Union
import numpy as np
import cv2

from .convert_model import ColorSpace, ColorSpaceDetector, Conversion
from ..utils import get_h_w_c


GRAY = ColorSpace(0, "Gray", 1)
RGB = ColorSpace(1, "RGB", 3)
RGBA = ColorSpace(2, "RGBA", 4)
YUV = ColorSpace(3, "YUV", 3)
HSV = ColorSpace(4, "HSV", 3)
HSL = ColorSpace(5, "HSL", 3)
CMYK = ColorSpace(6, "CMYK", 4)

RGB_LIKE = ColorSpaceDetector(1000, "Gray/RGB/RGBA", [GRAY, RGB, RGBA])

color_spaces: List[ColorSpace] = [
    RGB,
    RGBA,
    GRAY,
    YUV,
    HSV,
    HSL,
    CMYK,
]
color_spaces_or_detectors: List[Union[ColorSpace, ColorSpaceDetector]] = [
    RGB_LIKE,
    YUV,
    HSV,
    HSL,
    CMYK,
]


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


def __rgb_to_hsl(img: np.ndarray) -> np.ndarray:
    img = cv2.cvtColor(img, cv2.COLOR_BGR2HLS)
    h = img[:, :, 0] / 360  # type: ignore
    l = img[:, :, 1]
    s = img[:, :, 2]
    return cv2.merge((l, s, h))


def __hsl_to_rgb(img: np.ndarray) -> np.ndarray:
    h = img[:, :, 2] * 360
    s = img[:, :, 1]
    l = img[:, :, 0]
    return cv2.cvtColor(cv2.merge((h, l, s)), cv2.COLOR_HLS2BGR)


def __hsv_to_hsl(img: np.ndarray) -> np.ndarray:
    # the S and HSV and HSL are different, only the H is the same
    h = img[:, :, 2]
    hls = cv2.cvtColor(__hsv_to_rgb(img), cv2.COLOR_BGR2HLS)
    l = hls[:, :, 1]
    s = hls[:, :, 2]
    return cv2.merge((l, s, h))


def __hsl_to_hsv(img: np.ndarray) -> np.ndarray:
    # the S and HSV and HSL are different, only the H is the same
    h = img[:, :, 2]
    hsv = cv2.cvtColor(__hsl_to_rgb(img), cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    return cv2.merge((v, s, h))


def __rgb_to_cmyk(img: np.ndarray) -> np.ndarray:
    b, g, r = img[:, :, 0], img[:, :, 1], img[:, :, 2]
    maximum = np.max(img, axis=2)
    soft_max = np.maximum(maximum, 0.001)
    c = 1 - r / soft_max
    m = 1 - g / soft_max
    y = 1 - b / soft_max
    k = 1 - maximum
    return cv2.merge((y, m, c, k))


def __cmyk_to_rgb(img: np.ndarray) -> np.ndarray:
    y, m, c, k = img[:, :, 0], img[:, :, 1], img[:, :, 2], img[:, :, 3]
    maximum = 1 - k
    r = (1 - c) * maximum
    g = (1 - m) * maximum
    b = (1 - y) * maximum
    return cv2.merge((b, g, r))


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
    # HSV/HSL
    Conversion(
        direction=(RGB, HSV),
        convert=__rgb_to_hsv,
    ),
    Conversion(
        direction=(HSV, RGB),
        convert=__hsv_to_rgb,
        cost=__CHROMA_LOST,
    ),
    Conversion(
        direction=(RGB, HSL),
        convert=__rgb_to_hsl,
    ),
    Conversion(
        direction=(HSL, RGB),
        convert=__hsl_to_rgb,
        cost=__CHROMA_LOST,
    ),
    Conversion(
        direction=(HSV, HSL),
        convert=__hsv_to_hsl,
    ),
    Conversion(
        direction=(HSL, HSV),
        convert=__hsl_to_hsv,
    ),
    # CMYK
    Conversion(
        direction=(RGB, CMYK),
        convert=__rgb_to_cmyk,
    ),
    Conversion(
        direction=(CMYK, RGB),
        convert=__cmyk_to_rgb,
        cost=__CHROMA_LOST,
    ),
]
