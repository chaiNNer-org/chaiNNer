from typing import Tuple

import numpy as np

from .common import as_dtype, as_float32, map_channels
from .constants import THRESHOLD_MAPS, ThresholdMap


def get_threshold_map(
    image_shape: Tuple[int, int], threshold_map: ThresholdMap
) -> np.ndarray:
    """
    Normalize the threshold map and tile it to match the given image shape.
    """
    tm = THRESHOLD_MAPS[threshold_map].astype("float32")
    tm = tm / tm.size - 0.5
    repeats = (np.array(image_shape) // tm.shape[0]) + 1
    tm = np.tile(tm, repeats)  # type: ignore
    return tm[: image_shape[0], : image_shape[1]]


def one_channel_ordered_dither(
    image: np.ndarray, threshold_map: ThresholdMap, num_colors: int
) -> np.ndarray:
    """
    Apply an ordered dithering algorithm to the input greyscale image.  The output will be dithered and
    quantized to the given number of evenly-spaced values.

    The output will be the same shape and dtype as the input.
    """

    tm = get_threshold_map(image.shape, threshold_map=threshold_map)
    return as_dtype(
        np.floor(as_float32(image) * (num_colors - 1) + tm + 0.5) / (num_colors - 1),
        image.dtype,
    )


def ordered_dither(
    image: np.ndarray, threshold_map: ThresholdMap, num_colors: int
) -> np.ndarray:
    return map_channels(
        image,
        lambda channel: one_channel_ordered_dither(channel, threshold_map, num_colors),
    )
