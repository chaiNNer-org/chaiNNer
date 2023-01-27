import math
from collections import deque
from sanic.log import logger

import numpy as np

from .common import find_closest_uniform_color, apply_to_all_channels, dtype_to_float, float_to_dtype
from .hilbert import HilbertCurve


def is_power_of_two(x: int) -> bool:
    # powers of two have only one bit high
    if x == 0:
        return False
    while x:
        if x & 0b1:
            return x == 0b1
        x >>= 1


def error_sum(history: deque, decay_ratio: float):
    b = math.e ** (math.log(decay_ratio) / (history.maxlen - 1))
    return sum(x * (b ** i) for i, x in enumerate(history))


def one_channel_riemersma_dither(img: np.ndarray, history_length: int, decay_ratio: float,
                                 num_colors: int) -> np.ndarray:
    assert img.shape[0] == img.shape[1] and is_power_of_two(
        img.shape[0]), "Riemersma dithering only works with square images with a side length that's a power of two."

    original_dtype = img.dtype
    img = dtype_to_float(img)

    out = np.zeros_like(img)
    history = deque(maxlen=history_length)

    for i, j in HilbertCurve(img.shape[0]):
        es = error_sum(history, decay_ratio)
        value = img[i, j] + es
        out[i, j] = find_closest_uniform_color(value, num_colors)
        history.appendleft(img[i, j] - out[i, j])
    return float_to_dtype(out, original_dtype)


def riemersma_dither(image: np.ndarray, history_length: int, decay_ratio: float,
                     num_colors: int) -> np.ndarray:
    return apply_to_all_channels(one_channel_riemersma_dither, image, history_length=history_length,
                                 decay_ratio=decay_ratio, num_colors=num_colors)
