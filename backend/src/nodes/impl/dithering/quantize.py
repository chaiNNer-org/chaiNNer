from typing import Union

import numpy as np

from .common import dtype_to_float, float_to_dtype, apply_to_all_channels


def one_channel_nearest_uniform_color(
    value: Union[np.ndarray, float], num_colors: int
) -> float:
    return np.floor(value * (num_colors - 1) + 0.5) / (num_colors - 1)


def one_channel_batch_nearest_uniform_color(
    image: np.ndarray, num_colors: int
) -> np.ndarray:
    return float_to_dtype(
        np.floor(dtype_to_float(image) * (num_colors - 1) + 0.5) / (num_colors - 1),
        image.dtype,
    )


def batch_nearest_uniform_color(image: np.ndarray, num_colors: int) -> np.ndarray:
    return apply_to_all_channels(
        one_channel_batch_nearest_uniform_color, image, num_colors=num_colors
    )
