import math
from collections import deque

import numpy as np

from .color_distance import (
    nearest_palette_color,
    nearest_uniform_color,
)
from .common import dtype_to_float, float_to_dtype
from .hilbert import HilbertCurve
from ..image_utils import as_3d


def _next_power_of_two(x: int) -> int:
    n = 1
    while n < x:
        n <<= 1
    return n


def _error_sum(history: deque, decay_ratio: float, value_type):
    b = math.e ** (math.log(decay_ratio) / (history.maxlen - 1))
    z = value_type()
    for i, x in enumerate(history):
        z += x * b**i
    return z


def riemersma_dither(
    image: np.ndarray, history_length: int, decay_ratio: float, nearest_color_func
) -> np.ndarray:
    image = as_3d(image)

    curve_size = _next_power_of_two(max(image.shape))

    original_dtype = image.dtype
    image = dtype_to_float(image)

    out = np.zeros_like(image)
    history = deque(maxlen=history_length)

    for i, j in HilbertCurve(curve_size):
        if i >= image.shape[0] or j >= image.shape[1]:
            continue
        es = _error_sum(history, decay_ratio, lambda: np.zeros((image.shape[2])))
        pixel = image[i, j, :] + es
        out[i, j, :] = nearest_color_func(pixel)
        history.appendleft(image[i, j, :] - out[i, j, :])
    return float_to_dtype(out, original_dtype)


def uniform_riemersma_dither(
    image: np.ndarray, history_length: int, decay_ratio: float, num_colors: int
) -> np.ndarray:
    def nearest_color_func(pixel: np.ndarray) -> np.ndarray:
        return nearest_uniform_color(pixel, num_colors)

    return riemersma_dither(image, history_length, decay_ratio, nearest_color_func)


def palette_riemersma_dither(
    image: np.ndarray,
    palette: np.ndarray,
    history_length: int,
    decay_ratio: float,
) -> np.ndarray:
    palette = as_3d(palette)

    def nearest_color_func(pixel: np.ndarray) -> np.ndarray:
        return nearest_palette_color(pixel, palette)

    return riemersma_dither(image, history_length, decay_ratio, nearest_color_func)
