import numpy as np

from ...utils.utils import get_h_w_c
from ..image_op import ImageOp


def passthrough_single_color(img: np.ndarray, scale: int, op: ImageOp) -> np.ndarray:
    """
    If the given image is a single-color image, it will be scaled and returned as is instead of being processed by the given operation.
    Obviously, this optimization is only correct if `op` doesn't change the color of single-color images.

    To make this a transparent optimization, it is important that `scale` is correct.
    `scale` must be the same factor by which `op` changes the dimension of the image.
    """

    h, w, c = get_h_w_c(img)

    if c == 1:
        unique_list = np.unique(img)
        if len(unique_list) == 1:
            return np.full((h * scale, w * scale), unique_list[0], np.float32)
    else:
        unique_values = []
        is_unique = True
        for channel in range(c):
            unique_list = np.unique(img[:, :, channel])
            if len(unique_list) == 1:
                unique_values.append(unique_list[0])
            else:
                is_unique = False
                break

        if is_unique:
            channels = [
                np.full((h * scale, w * scale), unique_values[channel], np.float32)
                for channel in range(c)
            ]
            return np.dstack(channels)

    return op(img)
