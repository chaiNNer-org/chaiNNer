from enum import Enum
from typing import Tuple, Dict

import numpy as np

from .common import dtype_to_float, float_to_dtype
from ..image_utils import as_3d


def _check_inputs(pixel: np.ndarray, color: np.ndarray):
    if pixel.shape != color.shape:
        raise RuntimeError(
            "Trying to compare color distance between different numbers of channels."
        )


def euclidean_color_distance(pixel: np.ndarray, color: np.ndarray) -> float:
    _check_inputs(pixel, color)
    return np.power(pixel - color, 2).mean()


def _batch_prepare_inputs(
    image: np.ndarray, color: np.ndarray
) -> Tuple[np.ndarray, np.ndarray]:
    image = as_3d(image)

    if color.ndim != 1:
        raise RuntimeError("color must be a 1d array")
    if image.shape[2] != color.size:
        raise RuntimeError("image and color must have the same number of channels")

    return dtype_to_float(image), dtype_to_float(color)


def batch_euclidean_color_distance(image: np.ndarray, color: np.ndarray) -> np.ndarray:
    """
    Given an image and a color, return a greyscale image where each pixel contains the distance of the corresponding
    input pixel from the given color.
    """
    image, color = _batch_prepare_inputs(image, color)
    return np.power(image[:, :] - color, 2).mean(axis=2)


def nearest_palette_color(
    pixel: np.ndarray,
    palette: np.ndarray,
) -> np.ndarray:

    palette = as_3d(palette)

    closest = None
    closest_distance = None

    for idx in range(palette.shape[1]):
        color = palette[0, idx, :]
        distance = euclidean_color_distance(pixel, color)
        if closest is None or distance < closest_distance:
            closest = color
            closest_distance = distance

    return closest


def batch_nearest_palette_color(
    image: np.ndarray,
    palette: np.ndarray,
) -> np.ndarray:
    palette = as_3d(palette)

    output = np.zeros(
        (image.shape[0], image.shape[1], palette.shape[2]), dtype="float32"
    )
    low_water_mark = np.zeros((image.shape[0], image.shape[1]), dtype="float32")

    for idx in range(palette.shape[1]):
        color = palette[0, idx, :]
        distance = batch_euclidean_color_distance(image, color)
        if idx == 0:
            output[:, :] = color
            low_water_mark[:, :] = distance
        else:
            # boolean mask indicating pixels that are closer to this color than their current assignment
            closest_mask = distance < low_water_mark

            output[closest_mask] = color
            distance[closest_mask] = distance[closest_mask]

    return output


def nearest_uniform_color(value: np.ndarray, num_colors: int) -> np.ndarray:
    return np.floor(value * (num_colors - 1) + 0.5) / (num_colors - 1)


def batch_nearest_uniform_color(image: np.ndarray, num_colors: int) -> np.ndarray:
    return float_to_dtype(
        np.floor(dtype_to_float(image) * (num_colors - 1) + 0.5) / (num_colors - 1),
        image.dtype,
    )
