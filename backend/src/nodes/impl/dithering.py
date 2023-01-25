import numpy as np
from enum import Enum
from sanic.log import logger
from typing import Tuple

from ..utils.utils import get_h_w_c

# https://en.wikipedia.org/wiki/Ordered_dithering
BAYER_THRESHOLD_MAPS = {
    2: np.array([[0, 2], [3, 1]]),
    4: np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]),
    8: np.array([[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
                 [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
                 [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
                 [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]]),
    16: np.array([[0, 191, 48, 239, 12, 203, 60, 251, 3, 194, 51, 242, 15, 206, 63, 254],
                  [127, 64, 175, 112, 139, 76, 187, 124, 130, 67, 178, 115, 142, 79, 190, 127],
                  [32, 223, 16, 207, 44, 235, 28, 219, 35, 226, 19, 210, 47, 238, 31, 222],
                  [159, 96, 143, 80, 171, 108, 155, 92, 162, 99, 146, 83, 174, 111, 158, 95],
                  [8, 199, 56, 247, 4, 195, 52, 243, 11, 202, 59, 250, 7, 198, 55, 246],
                  [135, 72, 183, 120, 131, 68, 179, 116, 138, 75, 186, 123, 134, 71, 182, 119],
                  [40, 231, 24, 215, 36, 227, 20, 211, 43, 234, 27, 218, 39, 230, 23, 214],
                  [167, 104, 151, 88, 163, 100, 147, 84, 170, 107, 154, 91, 166, 103, 150, 87],
                  [2, 193, 50, 241, 14, 205, 62, 253, 1, 192, 49, 240, 13, 204, 61, 252],
                  [129, 66, 177, 114, 141, 78, 189, 126, 128, 65, 176, 113, 140, 77, 188, 125],
                  [34, 225, 18, 209, 46, 237, 30, 221, 33, 224, 17, 208, 45, 236, 29, 220],
                  [161, 98, 145, 82, 173, 110, 157, 94, 160, 97, 144, 81, 172, 109, 156, 93],
                  [10, 201, 58, 249, 6, 197, 54, 245, 9, 200, 57, 248, 5, 196, 53, 244],
                  [137, 74, 185, 122, 133, 70, 181, 118, 136, 73, 184, 121, 132, 69, 180, 117],
                  [42, 233, 26, 217, 38, 229, 22, 213, 41, 232, 25, 216, 37, 228, 21, 212],
                  [169, 106, 153, 90, 165, 102, 149, 86, 168, 105, 152, 89, 164, 101, 148, 85]]),
}


# Copied from onnx/np_tensor_utils.py
MAX_VALUES_BY_DTYPE = {
    np.dtype("int8"): 127,
    np.dtype("uint8"): 255,
    np.dtype("int16"): 32767,
    np.dtype("uint16"): 65535,
    np.dtype("int32"): 2147483647,
    np.dtype("uint32"): 4294967295,
    np.dtype("int64"): 9223372036854775807,
    np.dtype("uint64"): 18446744073709551615,
    np.dtype("float32"): 1.0,
    np.dtype("float64"): 1.0,
}


def get_threshold_map(image_shape: Tuple[int, int], map_size: int) -> np.ndarray:
    if map_size == 0:
        return np.array([[0]])
    threshold_map = BAYER_THRESHOLD_MAPS[map_size].astype("float32") / map_size ** 2 - 0.5
    repeats = (np.array(image_shape) // map_size) + 1
    threshold_map = np.tile(threshold_map, repeats)
    return threshold_map[:image_shape[0], :image_shape[1]]


def dtype_to_float(image: np.ndarray) -> np.ndarray:
    max_value = MAX_VALUES_BY_DTYPE.get(image.dtype, 1.0)
    return image.astype(np.dtype("float32")) / max_value


def float_to_dtype(image: np.ndarray, dtype: np.dtype) -> np.ndarray:
    max_value = MAX_VALUES_BY_DTYPE.get(dtype, 1.0)
    return (image * max_value).astype(dtype)


def quantize_float_image(image: np.ndarray, num_colors: int) -> np.ndarray:
    # image should have values in the range [0-1]
    return np.floor(image * (num_colors - 1) + 0.5) / (num_colors - 1)


def one_channel_bayer_filter(image: np.ndarray, map_size: int, num_colors: int) -> np.ndarray:
    """
    Apply a Bayer dithering algorithm to the input greyscale image.  The output will be dithered and
    quantized to the given number of evenly-spaced values.

    The output will be the same shape and dtype as the input.
    """

    threshold_map = get_threshold_map(image.shape, map_size=map_size)
    out_image = quantize_float_image(dtype_to_float(image) + threshold_map, num_colors=num_colors)
    return float_to_dtype(out_image, image.dtype)


def bayer_filter(image: np.ndarray, map_size: int, num_colors: int) -> np.ndarray:
    if image.ndim == 2:
        return one_channel_bayer_filter(image, map_size, num_colors)

    # Apply dithering to each channel separately
    output_image = np.stack([
        one_channel_bayer_filter(image[:, :, channel], map_size, num_colors) for channel in range(image.shape[2])
    ], axis=2)

    return output_image
