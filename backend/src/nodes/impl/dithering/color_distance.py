from enum import Enum
from typing import Tuple

import numpy as np

from .common import dtype_to_float
from ..image_utils import as_3d


def _check_inputs(pixel: np.ndarray, color: np.ndarray, expect_rgb=False):
    if pixel.shape != color.shape:
        raise RuntimeError(
            "Trying to compare color distance between different numbers of channels."
        )
    if expect_rgb and pixel.shape != (3,):
        raise RuntimeError("Weighted euclidean distance functions expect RGB input")


def euclidean_color_distance(pixel: np.ndarray, color: np.ndarray) -> float:
    _check_inputs(pixel, color)
    return np.power(pixel - color, 2).mean()


"""
Batch functions take an image and a color and return a greyscale map showing the distance from each pixel in the input
image to the given color.

This takes advantage of numpy's linear algebra implementation, so it'll be faster than looping over each pixel.
"""


def _batch_prepare_inputs(
    image: np.ndarray, color: np.ndarray
) -> Tuple[np.ndarray, np.ndarray]:
    if image.ndim == 2:
        image = as_3d(image)

    if color.ndim != 1:
        raise RuntimeError("color must be a 1d array")
    if image.shape[2] != color.size:
        raise RuntimeError("image and color must have the same number of channels")

    return dtype_to_float(image), dtype_to_float(color)


def batch_euclidean_color_distance(image: np.ndarray, color: np.ndarray) -> np.ndarray:
    image, color = _batch_prepare_inputs(image, color)
    max_distance = image.shape[2]
    delta = dtype_to_float(image[:, :]) - color
    return np.power(delta, 2).sum(axis=2) / max_distance


class ColorDistanceFunction(Enum):
    EUCLIDEAN = "L2"


COLOR_DISTANCE_FUNCTIONS = {
    ColorDistanceFunction.EUCLIDEAN: euclidean_color_distance,
}
COLOR_DISTANCE_BATCH_FUNCTIONS = {
    ColorDistanceFunction.EUCLIDEAN: batch_euclidean_color_distance,
}
COLOR_DISTANCE_FUNCTION_LABELS = {
    ColorDistanceFunction.EUCLIDEAN: "Euclidean Distance",
}
