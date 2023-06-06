from typing import Callable

import numpy as np

from ..image_utils import MAX_VALUES_BY_DTYPE


def as_dtype(image: np.ndarray, target_dtype: np.dtype):
    if image.dtype == target_dtype:
        return image

    image = as_float32(image)
    return _float_to_dtype(image, target_dtype)


def as_float32(image: np.ndarray) -> np.ndarray:
    if image.dtype == np.float32:
        return image
    max_value = MAX_VALUES_BY_DTYPE[image.dtype]
    return image.astype(np.float32) / max_value


def _float_to_dtype(image: np.ndarray, dtype: np.dtype) -> np.ndarray:
    if image.dtype == dtype:
        return image
    max_value = MAX_VALUES_BY_DTYPE[dtype]
    return (image * max_value).astype(dtype)


def map_channels(
    image: np.ndarray, fn: Callable[[np.ndarray], np.ndarray]
) -> np.ndarray:
    if image.ndim == 2:
        return fn(image)
    else:
        return np.dstack(
            [fn(image[:, :, channel]) for channel in range(image.shape[2])],
        )
