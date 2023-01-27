from enum import Enum
from typing import Tuple

import numpy as np

from .common import dtype_to_float
from ..image_utils import as_3d


def _check_inputs(pixel: np.ndarray, color: np.ndarray, expect_rgb=False):
    if pixel.shape != color.shape:
        raise RuntimeError("Trying to compare color distance between different numbers of channels.")
    if expect_rgb and pixel.shape != (3,):
        raise RuntimeError("Weighted euclidean distance functions expect RGB input")


def manhattan_color_distance(pixel: np.ndarray, color: np.ndarray) -> float:
    _check_inputs(pixel, color)
    return np.abs(pixel - color).mean()


def euclidean_color_distance(pixel: np.ndarray, color: np.ndarray) -> float:
    _check_inputs(pixel, color)
    return np.power(pixel - color, 2).mean()


def red_weighted_euclidean_color_distance(pixel: np.ndarray, color: np.ndarray) -> float:
    # https://www.compuphase.com/cmetric.htm
    # weights that work well when red > 0.5
    _check_inputs(pixel, color, expect_rgb=True)
    return np.dot(np.power(pixel - color, 2).mean(), [3, 4, 2]).sum() / 9


def non_red_weighted_euclidean_color_distance(pixel: np.ndarray, color: np.ndarray) -> float:
    # https://www.compuphase.com/cmetric.htm
    # weights that work well when red < 0.5
    _check_inputs(pixel, color, expect_rgb=True)
    return np.dot(np.power(pixel - color, 2).mean(), [2, 4, 3]).sum() / 9


def adaptive_weighted_euclidean_color_distance(pixel: np.ndarray, color: np.ndarray) -> float:
    # https://www.compuphase.com/cmetric.htm
    # Interpolate the "red" and "non-red" weights above based on mean red value
    _check_inputs(pixel, color, expect_rgb=True)
    mean_red = (pixel[0] + color[0]) / 2
    return np.dot(np.power(pixel - color, 2).mean(), [2 + mean_red, 4, 3 - mean_red]).sum() / 9


"""
Batch functions take an image and a color and return a greyscale map showing the distance from each pixel in the input
image to the given color.

This takes advantage of numpy's linear algebra implementation, so it'll be faster than looping over each pixel.
"""


def _batch_prepare_inputs(image: np.ndarray, color: np.ndarray, expect_rgb=False) -> Tuple[np.ndarray, np.ndarray]:
    if image.ndim == 2:
        image = as_3d(image)

    if color.ndim != 1:
        raise RuntimeError("color must be a 1d array")
    if image.shape[2] != color.size:
        raise RuntimeError("image and color must have the same number of channels")
    if expect_rgb and color.shape != 3:
        raise RuntimeError("weighted euclidean color distance assumes a certain colorspace (probably RGB)")

    return dtype_to_float(image), dtype_to_float(color)


def _batch_weighted_euclidean_color_distance(image: np.ndarray, color: np.ndarray, weights: np.ndarray) -> np.ndarray:
    image, color = _batch_prepare_inputs(image, color, expect_rgb=True)
    delta = dtype_to_float(image[:, :]) - color
    squared_delta = np.power(delta, dtype_to_float(image[:, :]) - color)
    return (squared_delta[:, :] * weights).mean(axis=2)


def batch_manhattan_color_distance(image: np.ndarray, color: np.ndarray) -> np.ndarray:
    image, color = _batch_prepare_inputs(image, color)
    max_distance = image.shape[2]
    delta = dtype_to_float(image[:, :]) - color
    return np.abs(delta).sum(axis=2) / max_distance


def batch_euclidean_color_distance(image: np.ndarray, color: np.ndarray) -> np.ndarray:
    image, color = _batch_prepare_inputs(image, color)
    max_distance = image.shape[2]
    delta = dtype_to_float(image[:, :]) - color
    return np.power(delta, 2).sum(axis=2) / max_distance


def batch_red_weighted_euclidean_color_distance(image: np.ndarray, color: np.ndarray) -> np.ndarray:
    # https://www.compuphase.com/cmetric.htm
    # weights that work well when red > 0.5
    weights = np.array([3, 4, 2])
    return _batch_weighted_euclidean_color_distance(image, color, weights)


def batch_non_red_weighted_euclidean_color_distance(image: np.ndarray, color: np.ndarray) -> np.ndarray:
    # https://www.compuphase.com/cmetric.htm
    # weights that work well when red < 0.5
    weights = np.array([2, 4, 3])
    return _batch_weighted_euclidean_color_distance(image, color, weights)


def batch_adaptive_weighted_euclidean_color_distance(image: np.ndarray, color: np.ndarray) -> np.ndarray:
    # https://www.compuphase.com/cmetric.htm
    # Interpolate the "red" and "non-red" weights above based on mean red value
    image, color = _batch_prepare_inputs(image, color)
    if color.size != 3:
        raise RuntimeError("Adaptive Weighted Euclidean color distance works with RGB")

    mean_red = (image[:, :, 0] + color[0]) / 2
    weights = np.stack([2 + mean_red, np.full(image.shape[:2], 4), 3 - mean_red], axis=2)
    max_distance = 2 + 4 + 3

    delta = dtype_to_float(image[:, :]) - color
    squared_delta = np.power(delta, dtype_to_float(image[:, :]) - color)
    return (squared_delta[:, :] * weights).sum(axis=2) / max_distance


class ColorDistanceFunction(Enum):
    MANHATTAN = "L1"
    EUCLIDEAN = "L2"
    RED_WEIGHTED_EUCLIDEAN = "RWL2"
    NON_RED_WEIGHTED_EUCLIDEAN = "BWL2"
    WEIGHTED_EUCLIDEAN = "WL2"


COLOR_DISTANCE_FUNCTIONS = {
    ColorDistanceFunction.MANHATTAN: manhattan_color_distance,
    ColorDistanceFunction.EUCLIDEAN: euclidean_color_distance,
    ColorDistanceFunction.RED_WEIGHTED_EUCLIDEAN: red_weighted_euclidean_color_distance,
    ColorDistanceFunction.NON_RED_WEIGHTED_EUCLIDEAN: non_red_weighted_euclidean_color_distance,
    ColorDistanceFunction.WEIGHTED_EUCLIDEAN: adaptive_weighted_euclidean_color_distance,
}
COLOR_DISTANCE_BATCH_FUNCTIONS = {
    ColorDistanceFunction.MANHATTAN: batch_manhattan_color_distance,
    ColorDistanceFunction.EUCLIDEAN: batch_euclidean_color_distance,
    ColorDistanceFunction.RED_WEIGHTED_EUCLIDEAN: batch_red_weighted_euclidean_color_distance,
    ColorDistanceFunction.NON_RED_WEIGHTED_EUCLIDEAN: batch_non_red_weighted_euclidean_color_distance,
    ColorDistanceFunction.WEIGHTED_EUCLIDEAN: batch_adaptive_weighted_euclidean_color_distance,
}
COLOR_DISTANCE_FUNCTION_LABELS = {
    ColorDistanceFunction.MANHATTAN: "Manhattan Distance",
    ColorDistanceFunction.EUCLIDEAN: "Euclidean Distance",
    ColorDistanceFunction.RED_WEIGHTED_EUCLIDEAN: "Weighted Euclidean Distance",
    ColorDistanceFunction.NON_RED_WEIGHTED_EUCLIDEAN: "Weighted Euclidean Distance 2",
    ColorDistanceFunction.WEIGHTED_EUCLIDEAN: "Adaptive Weighted Euclidean Distance",
}
