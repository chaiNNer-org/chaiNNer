import cv2
import numpy as np

from ..utils.utils import get_h_w_c
from .image_utils import as_2d_grayscale


def _luminance(img: np.ndarray) -> np.ndarray:
    """Returns the luminance of an image."""
    _, _, c = get_h_w_c(img)
    if c == 1:
        return as_2d_grayscale(img)
    if c == 2:
        return img[..., 0]
    return np.dot(img[..., :3], [0.2126, 0.7152, 0.0722])


def create_cas_mask(img: np.ndarray, kernel: np.ndarray, bias: float = 2) -> np.ndarray:
    """
    Uses contrast adaptive sharpening's method to create a mask to interpolate between the original
    and sharpened image.

    `kernel` is an element create by `cv2.getStructuringElement`. It determines the shape and size
    of each pixel's neighborhood.

    `bias` is used to bias the mask towards the more sharpening. A value of 1 means no bias, a
    value greater than 1 biases the mask towards the sharpened image, a value less than 1 biases
    the mask towards the original image.

    Reference:
    Lou Kramer, FidelityFX CAS, AMD Developer Day 2019, https://gpuopen.com/wp-content/uploads/2019/07/FidelityFX-CAS.pptx
    https://www.shadertoy.com/view/wtlSWB#
    """
    if bias <= 0:
        raise ValueError("Bias must be greater than or equal to 0.")

    l = _luminance(img)
    min_l = cv2.erode(l, kernel)
    max_l = cv2.dilate(l, kernel)
    min_d = np.minimum(1.0 - max_l, min_l, out=min_l)  # type: ignore
    max_l += 1e-8  # type: ignore
    min_d /= max_l
    mask = min_d
    if bias != 1:
        mask = np.power(mask, 1 / bias, out=mask)
    return mask


def cas_mix(
    img: np.ndarray,
    sharpened: np.ndarray,
    kernel: np.ndarray,
    bias: float = 2,
) -> np.ndarray:
    mask = create_cas_mask(img, kernel, bias)
    _, _, c = get_h_w_c(sharpened)
    if c > 1:
        mask = np.dstack((mask,) * c)
    return img * (1 - mask) + sharpened * mask  # type: ignore
