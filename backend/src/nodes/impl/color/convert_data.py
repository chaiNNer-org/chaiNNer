from __future__ import annotations

import math
from typing import Dict, List

import cv2
import numpy as np

from ...utils.utils import get_h_w_c
from .convert_model import ColorSpace, ColorSpaceDetector, Conversion

GRAY = ColorSpace(0, "Gray", 1)
RGB = ColorSpace(1, "RGB", 3)
RGBA = ColorSpace(2, "RGBA", 4)
YUV = ColorSpace(3, "YUV", 3)
HSV = ColorSpace(4, "HSV", 3)
HSL = ColorSpace(5, "HSL", 3)
CMYK = ColorSpace(6, "CMYK", 4)
YUVA = ColorSpace(7, "YUVA", 4)
HSVA = ColorSpace(8, "HSVA", 4)
HSLA = ColorSpace(9, "HSLA", 4)
LAB = ColorSpace(10, "L*a*b*", 3)
LABA = ColorSpace(11, "L*a*b*A", 4)
LCH = ColorSpace(12, "L*C*h°", 3)
LCHA = ColorSpace(13, "L*C*h°A", 4)

RGB_LIKE = ColorSpaceDetector(1000, "RGB", [GRAY, RGB, RGBA])
YUV_LIKE = ColorSpaceDetector(1001, "YUV", [YUV, YUVA])
HSV_LIKE = ColorSpaceDetector(1002, "HSV", [HSV, HSVA])
HSL_LIKE = ColorSpaceDetector(1003, "HSL", [HSL, HSLA])
LAB_LIKE = ColorSpaceDetector(1004, "L*a*b*", [LAB, LABA])
LCH_LIKE = ColorSpaceDetector(1005, "L*C*h°", [LCH, LCHA])

ALPHA_PAIRS: Dict[ColorSpace, ColorSpace] = {
    RGB: RGBA,
    YUV: YUVA,
    HSV: HSVA,
    HSL: HSLA,
    LAB: LABA,
    LCH: LCHA,
}


def is_alpha_partner(c: ColorSpace) -> bool:
    """
    Whether this color space is returned by `get_alpha_partner` for some input.
    """
    return c in ALPHA_PAIRS.values()


def get_alpha_partner(c: ColorSpace) -> ColorSpace | None:
    """
    If the given color does NOT have an alpha channel and there exists another color space that this equivalent to the given one but does have an alpha, then the color space with an alpha channel will be returned, `None` otherwise.

    E.g. RGB will return RGBA and RGBA will return None.
    """
    return ALPHA_PAIRS.get(c, None)


color_spaces: List[ColorSpace] = [
    RGB,
    RGBA,
    GRAY,
    YUV,
    YUVA,
    HSV,
    HSVA,
    HSL,
    HSLA,
    CMYK,
    LAB,
    LABA,
    LCH,
    LCHA,
]
color_spaces_or_detectors: List[ColorSpace | ColorSpaceDetector] = [
    RGB_LIKE,
    GRAY,
    YUV_LIKE,
    HSV_LIKE,
    HSL_LIKE,
    CMYK,
    LAB_LIKE,
    LCH_LIKE,
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


def __rgb_to_lab(img: np.ndarray) -> np.ndarray:
    # 0≤L≤100 , −127≤a≤127, −127≤b≤127
    img = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l = img[:, :, 0] / 100
    a = (img[:, :, 1] + 127) / 254
    b = (img[:, :, 2] + 127) / 254
    return cv2.merge((b, a, l))


def __lab_to_rgb(img: np.ndarray) -> np.ndarray:
    # 0≤L≤100 , −127≤a≤127, −127≤b≤127
    l = img[:, :, 2] * 100
    a = img[:, :, 1] * 254 - 127
    b = img[:, :, 0] * 254 - 127
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)


def __lab_to_lch(img: np.ndarray) -> np.ndarray:
    l = img[:, :, 2]
    # a and b must be centered at 0
    a = img[:, :, 1] - 0.5
    b = img[:, :, 0] - 0.5

    c = np.hypot(a, b)
    h = np.arctan2(b, a)

    # normalize C and h to [0,1]
    #
    # This is quite simple for h, but not so much for C. The problem is that
    # the maximum value of C depends on h. This is because a*,b* in [-1,1] form
    # a square of possible value around the origin. C nd h are simple polar
    # coordinates where h is the angel and C is the distance from origin. Since
    # the corners of a square are farther away from the origin than the mid
    # point of the sides of the a square, the maximum value of C depends on the
    # angle. E.g. for h=0, the maximum C value is 0.5 and for h=45°, it's
    # sqrt(0.5).
    #
    # One strategy would be simple use the maximum value for all possible h
    # values (which is sqrt(0.5)), but this has the problem that it is now
    # possible to create C,h value pairs that create invalid a*,b* values.
    # Ideally, all possible values C,h values should map to valid a*,b* values.
    #
    # To solve this problem, we calculate the maximum C value for the current
    # h angle and use that to normalize C. `Cmax` for a,b in [-1,1] is defined
    # as follows: `Cmax = 1/max(abs(cos(h)), abs(sin(h)))`. Since, we use a,b
    # in [-0.5,0.5], we just have to divide that value by 2.
    c_max = 0.5 / np.maximum(np.abs(np.sin(h)), np.abs(np.cos(h)))
    c = c / c_max
    h = h / (math.pi * 2) + 0.5

    return cv2.merge((h, c, l))


def __lch_to_lab(img: np.ndarray) -> np.ndarray:
    l = img[:, :, 2]

    # undo the c and h [0,1] normalization
    h = (img[:, :, 0] - 0.5) * (math.pi * 2)
    sin_h = np.sin(h)
    cos_h = np.cos(h)
    c_max = 0.5 / np.maximum(np.abs(sin_h), np.abs(cos_h))
    c = img[:, :, 1] * c_max

    a = c * cos_h + 0.5
    b = c * sin_h + 0.5
    return cv2.merge((b, a, l))


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
    # LAB
    Conversion(
        direction=(RGB, LAB),
        convert=__rgb_to_lab,
    ),
    Conversion(
        direction=(LAB, RGB),
        convert=__lab_to_rgb,
    ),
    # LCH
    Conversion(
        direction=(LAB, LCH),
        convert=__lab_to_lch,
    ),
    Conversion(
        direction=(LCH, LAB),
        convert=__lch_to_lab,
        cost=__CHROMA_LOST,
    ),
]


# Add conversions that can be generated because only alpha is different
for dir_3, dir_4 in ALPHA_PAIRS.items():
    assert dir_3.channels == 3
    assert dir_4.channels == 4

    # Add and remove the alpha channel
    conversions.append(
        Conversion(
            direction=(dir_3, dir_4),
            convert=lambda i: cv2.cvtColor(i, cv2.COLOR_BGR2BGRA),
        )
    )
    conversions.append(
        Conversion(
            direction=(dir_4, dir_3),
            convert=lambda i: cv2.cvtColor(i, cv2.COLOR_BGRA2BGR),
            cost=__CHANNEL_LOST,
        )
    )

__ALPHA_3_to_4 = dict(ALPHA_PAIRS)
for conv in list(conversions):
    in_4 = __ALPHA_3_to_4.get(conv.input)
    out_4 = __ALPHA_3_to_4.get(conv.output)

    if in_4 is not None and out_4 is not None:
        # if we have a conversion X -> Y, then we can generate XA -> YA
        # e.g. RGBA -> HSVA can be generated from RGB -> HSV

        def create_convert(old_conv: Conversion):
            def convert(img: np.ndarray) -> np.ndarray:
                color = img[:, :, :3]
                alpha = img[:, :, 3]
                return np.dstack((old_conv.convert(color), alpha))

            return convert

        conversions.append(
            Conversion(
                direction=(in_4, out_4),
                convert=create_convert(conv),
                cost=conv.cost,
            )
        )
