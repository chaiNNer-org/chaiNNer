from __future__ import annotations

import math

import cv2
import numpy as np

from ..utils.utils import get_h_w_c
from .blend import BlendMode, blend_images


class ImageAverage:
    def __init__(self):
        self.total = None
        self.count = 0

    def add(self, img: np.ndarray):
        self.count += 1
        if self.total is None:
            self.total = img
        else:
            # Images can't just be added together, alpha channel must be corrected
            a = img[:, :, 3]
            self.total[:, :, 0] += img[:, :, 0] * a
            self.total[:, :, 1] += img[:, :, 1] * a
            self.total[:, :, 2] += img[:, :, 2] * a
            self.total[:, :, 3] += a

    def get_result(self) -> np.ndarray:
        assert self.total is not None

        f = 1 / np.maximum(self.total[:, :, 3], 0.0001)
        self.total[:, :, 0] *= f
        self.total[:, :, 1] *= f
        self.total[:, :, 2] *= f
        self.total[:, :, 3] *= 1 / self.count
        return self.total


def with_self_as_background(img: np.ndarray):
    """Changes the given image to the image overlayed with itself."""

    _, _, c = get_h_w_c(img)
    assert c == 4, "The image has to be an RGBA image"
    img[:, :, 3] = 1 - np.square(1 - img[:, :, 3])


def convert_to_binary_alpha(img: np.ndarray, threshold: float = 0.05):
    """Sets all pixels with alpha <= threshold to RGBA=(0,0,0,0)
    and sets the alpha to 1 otherwise."""

    _, _, c = get_h_w_c(img)
    assert c == 4, "The image has to be an RGBA image"

    a = np.greater(img[:, :, 3], threshold).astype(np.float32)
    img[:, :, 0] *= a
    img[:, :, 1] *= a
    img[:, :, 2] *= a
    img[:, :, 3] = a


def fragment_blur(
    img: np.ndarray, n: int, start_angle: float, distance: float
) -> np.ndarray:
    h, w, c = get_h_w_c(img)
    assert c == 4, "The image has to be an RGBA image"
    assert n >= 1

    avg = ImageAverage()
    for i in range(n):
        angle = math.pi * 2 * i / n + start_angle
        x_offset = int(math.cos(angle) * distance)
        y_offset = int(math.sin(angle) * distance)
        m = np.float32(
            [
                [1, 0, x_offset],
                [0, 1, y_offset],
            ]  # type: ignore
        )
        avg.add(cv2.warpAffine(img, m, (w, h)))

    return avg.get_result()


def fill_alpha_fragment_blur(img: np.ndarray) -> np.ndarray:
    result = img.copy()
    for i in range(0, 6):
        blurred = fragment_blur(img, 5, i, 1 << i)
        # Blurred tends to be a bit too transparent
        with_self_as_background(blurred)
        result = blend_images(result, blurred, BlendMode.NORMAL)

    return result


def fill_alpha_edge_extend(img: np.ndarray, distance: int) -> np.ndarray:
    """
    Given an image with binary alpha, with will fill transparent pixels by
    extending the closest color.

    This operation assumes that the image has been preprocessed with
    convert_to_binary_alpha.
    """

    _, _, c = get_h_w_c(img)
    assert c == 4, "The image has to be an RGBA image"

    proccessed_distance = 0
    it = 0
    while proccessed_distance < distance:
        # The distance by which we will offset the image in this iteration
        offset_distance = 1 + it // 4
        proccessed_distance += offset_distance
        it += 1

        # Construct the kernel for the 2D convolution
        # the kernel will be a "+" of 1s with a 0 at the center
        k = np.zeros(
            (offset_distance * 2 + 1, offset_distance * 2 + 1), dtype=np.float32
        )
        k[:, offset_distance] = 1
        k[offset_distance, :] = 1
        k[offset_distance, offset_distance] = 0

        r = cv2.filter2D(img, -1, k, borderType=cv2.BORDER_REPLICATE)

        # Correct alpha and color
        f = 1 / np.maximum(r[:, :, 3], 0.001)
        r[:, :, 0] *= f
        r[:, :, 1] *= f
        r[:, :, 2] *= f
        r[:, :, 3] = np.minimum(r[:, :, 3], 1)

        img = blend_images(img, r, BlendMode.NORMAL)
    return img
