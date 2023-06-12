import math
from collections import deque

import numpy as np

from ..image_utils import as_3d
from .color_distance import nearest_palette_color, nearest_uniform_color
from .common import as_dtype, as_float32
from .hilbert import HilbertCurve


def _next_power_of_two(x: int) -> int:
    n = 1
    while n < x:
        n <<= 1
    return n


def _error_sum(history: deque, base: float, channels: int):
    z = np.zeros((channels,), dtype="float32")
    for i, x in enumerate(history):
        z += x * base**i
    return z


def riemersma_dither(
    image: np.ndarray, history_length: int, decay_ratio: float, nearest_color_func
) -> np.ndarray:
    image = as_3d(image)

    curve_size = _next_power_of_two(max(image.shape))

    original_dtype = image.dtype
    image = as_float32(image)

    out = np.zeros_like(image)
    history = deque(maxlen=history_length)

    base = math.e ** (math.log(decay_ratio) / (history_length - 1))

    for i, j in HilbertCurve(curve_size):
        if i >= image.shape[0] or j >= image.shape[1]:
            continue
        es = _error_sum(history, base, image.shape[2])
        pixel = image[i, j, :] + es
        out[i, j, :] = nearest_color_func(pixel)
        history.appendleft(image[i, j, :] - out[i, j, :])  # type: ignore
    return as_dtype(out, original_dtype)


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
    palette = as_float32(as_3d(palette))

    cache = []

    def nearest_color_func(pixel: np.ndarray) -> np.ndarray:
        return nearest_palette_color(pixel, palette, cache=cache)

    return riemersma_dither(image, history_length, decay_ratio, nearest_color_func)
