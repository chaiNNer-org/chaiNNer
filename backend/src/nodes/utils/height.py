import numpy as np
from .utils import get_h_w_c


class HeightSource:
    AVG_RGB = 0
    MAX_RGB = 1
    # 1 - ((1-r) * (1-g) * (1-b))
    SCREEN_RGB = 2
    R = 3
    G = 4
    B = 5
    A = 6


def get_height_map(img: np.ndarray, source: int) -> np.ndarray:
    """
    Converts the given color/grayscale image to a height map.
    """
    h, w, c = get_h_w_c(img)

    assert c in (1, 3, 4), "Only grayscale, RGB, and RGBA images are supported"

    if source == HeightSource.A:
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

    if source == HeightSource.R:
        return r
    elif source == HeightSource.G:
        return g
    elif source == HeightSource.B:
        return b
    elif source == HeightSource.MAX_RGB:
        return np.maximum(np.maximum(r, g), b)
    elif source == HeightSource.AVG_RGB:
        return (r + g + b) / 3
    elif source == HeightSource.SCREEN_RGB:
        return 1 - ((1 - r) * (1 - g) * (1 - b))
    else:
        assert False, f"Invalid height source {source}."
