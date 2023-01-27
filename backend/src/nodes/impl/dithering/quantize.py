from typing import Tuple

import numpy as np

from .color_distance import ColorDistanceFunction, COLOR_DISTANCE_BATCH_FUNCTIONS, COLOR_DISTANCE_FUNCTIONS
from .common import dtype_to_float, float_to_dtype, apply_to_all_channels
from ..image_utils import as_3d


def nearest_color_quantize(image: np.ndarray, palette: np.ndarray,
                           color_distance_function: ColorDistanceFunction) -> np.ndarray:
    if palette.ndim == 2:
        palette = as_3d(palette)
    func = COLOR_DISTANCE_BATCH_FUNCTIONS[color_distance_function]

    output = np.zeros((image.shape[0], image.shape[1], palette.shape[2]), dtype="float32")
    low_water_mark = np.zeros((image.shape[0], image.shape[1]), dtype="float32")

    for idx in range(palette.shape[1]):
        color = palette[0, idx, :]
        distance = func(image, color)
        if idx == 0:
            output[:, :] = color
            low_water_mark[:,:] = distance
        else:
            # boolean mask indicating pixels that are closer to this color than their current assignment
            closest_mask = distance < low_water_mark

            output[closest_mask] = color
            distance[closest_mask] = distance[closest_mask]

    return output


def find_nearest_color(pixel: np.ndarray, palette: np.ndarray, color_distance_function: ColorDistanceFunction) -> Tuple[int, np.ndarray]:

    if palette.ndim == 2:
        palette = as_3d(palette)
    func = COLOR_DISTANCE_FUNCTIONS[color_distance_function]

    closest = None
    closest_idx = None
    closest_distance = None

    for idx in range(palette.shape[1]):
        color = palette[0,idx,:]
        distance = func(pixel, color)
        if closest is None or distance < closest_distance:
            closest = color
            closest_idx = idx
            closest_distance = distance

    return closest_idx, closest


def find_closest_uniform_color(value: float, num_colors: int) -> float:
    return np.floor(value * (num_colors - 1) + 0.5) / (num_colors - 1)


def uniform_quantize_image(image: np.ndarray, num_colors: int) -> np.ndarray:
    return np.floor(image * (num_colors - 1) + 0.5) / (num_colors - 1)


def one_channel_uniform_quantize(image: np.ndarray, num_colors: int) -> np.ndarray:
    out_image = uniform_quantize_image(
        dtype_to_float(image), num_colors=num_colors
    )
    return float_to_dtype(out_image, image.dtype)


def uniform_quantize(image: np.ndarray, num_colors: int) -> np.ndarray:
    return apply_to_all_channels(one_channel_uniform_quantize, image, num_colors=num_colors)
