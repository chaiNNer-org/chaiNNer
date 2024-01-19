from enum import Enum

import numpy as np

from ...utils.utils import get_h_w_c


class HeightSource(Enum):
    AVERAGE_RGB = 0
    MAX_RGB = 1
    # 1 - ((1-r) * (1-g) * (1-b))
    SCREEN_RGB = 2
    RED = 3
    GREEN = 4
    BLUE = 5
    ALPHA = 6


def get_height_map(img: np.ndarray, source: HeightSource) -> np.ndarray:
    """
    Converts the given color/grayscale image to a height map.
    """
    h, w, c = get_h_w_c(img)

    assert c in (1, 3, 4), "Only grayscale, RGB, and RGBA images are supported"

    if source == HeightSource.ALPHA:
        if c < 4:
            return np.ones((h, w), dtype=np.float32)
        return img[:, :, 3]

    if c == 1:
        if source == HeightSource.SCREEN_RGB:
            x = 1 - img
            return 1 - x * x * x
        return img

    r = img[:, :, 2]
    g = img[:, :, 1]
    b = img[:, :, 0]

    if source == HeightSource.RED:
        return r
    elif source == HeightSource.GREEN:
        return g
    elif source == HeightSource.BLUE:
        return b
    elif source == HeightSource.MAX_RGB:
        return np.maximum(np.maximum(r, g), b)
    elif source == HeightSource.AVERAGE_RGB:
        return (r + g + b) / 3
    elif source == HeightSource.SCREEN_RGB:
        return 1 - ((1 - r) * (1 - g) * (1 - b))
    else:
        raise AssertionError(f"Invalid height source {source}.")
