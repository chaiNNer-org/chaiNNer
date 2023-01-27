import math
from collections import deque

import numpy as np

from .color_distance import ColorDistanceFunction
from .common import apply_to_all_channels, dtype_to_float, float_to_dtype
from .quantize import find_closest_uniform_color, find_nearest_color
from .hilbert import HilbertCurve
from ..image_utils import as_3d


def next_power_of_two(x: int) -> int:
    n = 1
    while n < x:
        n <<= 1
    return n


def error_sum(history: deque, decay_ratio: float, value_type):
    b = math.e ** (math.log(decay_ratio) / (history.maxlen - 1))
    z = value_type()
    for i,x in enumerate(history):
        z += x * b ** i
    return z


def one_channel_riemersma_dither(image: np.ndarray, history_length: int, decay_ratio: float,
                                 num_colors: int) -> np.ndarray:

    curve_size = next_power_of_two(max(image.shape))

    original_dtype = image.dtype
    image = dtype_to_float(image)

    out = np.zeros_like(image)
    history = deque(maxlen=history_length)

    for i, j in HilbertCurve(curve_size):
        if i >= image.shape[0] or j >= image.shape[1]:
            continue
        es = error_sum(history, decay_ratio, float)
        value = image[i, j] + es
        out[i, j] = find_closest_uniform_color(value, num_colors)
        history.appendleft(image[i, j] - out[i, j])
    return float_to_dtype(out, original_dtype)


def riemersma_dither(image: np.ndarray, history_length: int, decay_ratio: float,
                     num_colors: int) -> np.ndarray:
    return apply_to_all_channels(one_channel_riemersma_dither, image, history_length=history_length,
                                 decay_ratio=decay_ratio, num_colors=num_colors)


def nearest_color_riemersma_dither(image: np.ndarray, palette: np.ndarray,
                                   color_distance_function: ColorDistanceFunction,
                                   history_length: int, decay_ratio: float) -> np.ndarray:
    if image.ndim == 2:
        image = as_3d(image)
    if palette.ndim == 2:
        palette = as_3d(palette)

    curve_size = next_power_of_two(max(image.shape))

    original_dtype = image.dtype
    image = dtype_to_float(image)

    out = np.zeros_like(image)
    history = deque(maxlen=history_length)

    for i, j in HilbertCurve(curve_size):
        if i >= image.shape[0] or j >= image.shape[1]:
            continue
        es = error_sum(history, decay_ratio, lambda: np.zeros((image.shape[2])))
        pixel = image[i, j, :] + es
        _, out[i, j, :] = find_nearest_color(pixel, palette, color_distance_function)
        history.appendleft(image[i, j, :] - out[i, j, :])
    return float_to_dtype(out, original_dtype)