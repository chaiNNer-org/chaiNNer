from typing import List

import numpy as np

from ..image_op import ImageOp


def grayscale_split(img: np.ndarray, process: ImageOp) -> np.ndarray:
    """
    This function guarantees that the given image operation method will be called with 2D single-channel images.
    The images passed into the operation are guaranteed to have the same size as the given image.
    """

    if img.ndim == 2:
        return process(img)

    assert img.ndim == 3
    c = img.shape[2]

    if c == 1:
        return process(img[:, :, 0])

    result_channels: List[np.ndarray] = []
    for channel in range(c):
        result_channels.append(process(img[:, :, channel]))

    return np.dstack(result_channels)
