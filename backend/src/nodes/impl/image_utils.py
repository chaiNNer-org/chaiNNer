from __future__ import annotations

import itertools
import os
import random
import string
from enum import Enum
from typing import List

import cv2
import numpy as np

from ..utils.utils import Padding, get_h_w_c, split_file_path

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


class FillColor(Enum):
    AUTO = -1
    BLACK = 0
    TRANSPARENT = 1

    def get_color(self, channels: int):
        """Select how to fill negative space that results from rotation"""

        if self == FillColor.AUTO:
            fill_color = (0,) * channels
        elif self == FillColor.BLACK:
            fill_color = (0,) * channels if channels < 4 else (0, 0, 0, 1)
        else:
            fill_color = (0, 0, 0, 0)

        return fill_color


class FlipAxis(Enum):
    HORIZONTAL = 1
    VERTICAL = 0
    BOTH = -1
    NONE = 2

    def flip(self, img: np.ndarray) -> np.ndarray:
        if self == FlipAxis.NONE:
            return img
        return cv2.flip(img, self.value)


class BorderType(Enum):
    REFLECT_MIRROR = 4
    WRAP = 3
    REPLICATE = 1
    BLACK = 0
    TRANSPARENT = 5


class NormalMapType(Enum):
    DIRECTX = "DirectX"
    OPENGL = "OpenGL"
    OCTAHEDRAL = "Octahedral"


def convert_to_BGRA(img: np.ndarray, in_c: int) -> np.ndarray:
    assert in_c in (1, 3, 4), f"Number of channels ({in_c}) unexpected"
    if in_c == 1:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif in_c == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    return img.copy()


def _get_iinfo(img: np.ndarray) -> np.iinfo | None:
    try:
        return np.iinfo(img.dtype)
    except:
        return None


def normalize(img: np.ndarray) -> np.ndarray:
    if img.dtype != np.float32:
        info = _get_iinfo(img)
        img = img.astype(np.float32)

        if info is not None:
            img /= info.max
            if info.min == 0:
                # we don't need to clip
                return img

        # we own `img`, so it's okay to write to it
        return np.clip(img, 0, 1, out=img)

    return np.clip(img, 0, 1)


def to_uint8(
    img: np.ndarray,
    normalized=False,
    dither=False,
) -> np.ndarray:
    """
    Returns a new uint8 image with the given image data.

    If `normalized` is `False`, then the image will be normalized before being converted to uint8.

    If `dither` is `True`, then dithering will be used to minimize the quantization error.
    """
    if img.dtype == np.uint8:
        return img.copy()

    if not normalized or img.dtype != np.float32:
        img = normalize(img)

    if not dither:
        return (img * 255).round().astype(np.uint8)

    # random dithering
    truth = img * 255
    quant = truth.round()

    err = truth - quant
    r = np.random.default_rng(0).uniform(0, 1, img.shape).astype(np.float32)
    quant += np.sign(err) * (np.abs(err) > r)

    return quant.astype(np.uint8)


def shift(img: np.ndarray, amount_x: int, amount_y: int, fill: FillColor) -> np.ndarray:
    c = get_h_w_c(img)[2]
    if fill == FillColor.TRANSPARENT:
        img = convert_to_BGRA(img, c)
    fill_color = fill.get_color(c)

    h, w, _ = get_h_w_c(img)
    translation_matrix = np.float32([[1, 0, amount_x], [0, 1, amount_y]])  # type: ignore
    img = cv2.warpAffine(
        img,
        translation_matrix,
        (w, h),
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=fill_color,
    )

    return img


def as_2d_grayscale(img: np.ndarray) -> np.ndarray:
    """Given a grayscale image, this returns an image with 2 dimensions (image.ndim == 2)."""
    if img.ndim == 2:
        return img
    if img.ndim == 3 and img.shape[2] == 1:
        return img[:, :, 0]
    assert False, f"Invalid image shape {img.shape}"


def as_3d(img: np.ndarray) -> np.ndarray:
    """Given a grayscale image, this returns an image with 3 dimensions (image.ndim == 3)."""
    if img.ndim == 2:
        return np.expand_dims(img.copy(), axis=2)
    return img


def as_target_channels(
    img: np.ndarray, target_c: int, narrowing: bool = False
) -> np.ndarray:
    """
    Given a number of target channels (either 1, 3, or 4), this convert the given image
    to an image with that many channels. If the given image already has the correct
    number of channels, it will be returned as is.

    Narrowing conversions are only supported if narrowing is True.
    """
    c = get_h_w_c(img)[2]

    if c == target_c == 1:
        return as_2d_grayscale(img)
    if c == target_c:
        return img

    if not narrowing:
        assert (
            c < target_c
        ), f"Narrowing is false, image channels ({c}) must be less than target channels ({target_c})"

    if c == 1:
        if target_c == 3:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        if target_c == 4:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)

    if c == 3:
        if target_c == 1:
            return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if target_c == 4:
            return cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    if c == 4:
        if target_c == 1:
            return cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
        if target_c == 3:
            return cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

    raise ValueError(f"Unable to convert {c} channel image to {target_c} channel image")


def create_border(
    img: np.ndarray,
    border_type: BorderType,
    border: Padding,
) -> np.ndarray:
    """
    Returns a new image with a specified border.
    """

    if border.empty:
        return img

    _, _, c = get_h_w_c(img)
    if c == 4 and border_type == BorderType.BLACK:
        value = (0, 0, 0, 1)
    else:
        value = 0

    cv_border_type: int = border_type.value
    if border_type == BorderType.TRANSPARENT:
        cv_border_type = cv2.BORDER_CONSTANT
        value = 0
        img = as_target_channels(img, 4)

    return cv2.copyMakeBorder(
        img,
        top=border.top,
        left=border.left,
        right=border.right,
        bottom=border.bottom,
        borderType=cv_border_type,
        value=value,
    )


def calculate_ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """Calculates mean localized Structural Similarity Index (SSIM)
    between two images."""

    C1 = 0.01**2
    C2 = 0.03**2

    kernel = cv2.getGaussianKernel(11, 1.5)
    window = np.outer(kernel, kernel.transpose())

    mu1 = cv2.filter2D(img1, -1, window)[5:-5, 5:-5]
    mu2 = cv2.filter2D(img2, -1, window)[5:-5, 5:-5]
    mu1_sq = mu1**2
    mu2_sq = mu2**2
    mu1_mu2 = mu1 * mu2
    sigma1_sq = cv2.filter2D(img1**2, -1, window)[5:-5, 5:-5] - mu1_sq
    sigma2_sq = cv2.filter2D(img2**2, -1, window)[5:-5, 5:-5] - mu2_sq
    sigma12 = cv2.filter2D(img1 * img2, -1, window)[5:-5, 5:-5] - mu1_mu2

    ssim_map = ((2 * mu1_mu2 + C1) * (2 * sigma12 + C2)) / (
        (mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2)
    )

    return float(np.mean(ssim_map))


def cv_save_image(path: str, img: np.ndarray, params: List[int]):
    """
    A light wrapper around `cv2.imwrite` to support non-ASCII paths.
    """

    # Write image with opencv if path is ascii, since imwrite doesn't support unicode
    # This saves us from having to keep the image buffer in memory, if possible
    if path.isascii():
        cv2.imwrite(path, img, params)
    else:
        dirname, _, extension = split_file_path(path)
        try:
            temp_filename = f'temp-{"".join(random.choices(string.ascii_letters, k=16))}.{extension}'
            full_temp_path = os.path.join(dirname, temp_filename)
            cv2.imwrite(full_temp_path, img, params)
            os.rename(full_temp_path, path)
        except:
            _, buf_img = cv2.imencode(f".{extension}", img, params)
            with open(path, "wb") as outf:
                outf.write(buf_img)


def cartesian_product(arrays: List[np.ndarray]) -> np.ndarray:
    """
    Returns the cartesian product of the given arrays. Good for initializing coordinates, for example.

    This is cartesian_product_transpose_pp from this following SO post by Paul Panzer:
    https://stackoverflow.com/questions/11144513/cartesian-product-of-x-and-y-array-points-into-single-array-of-2d-points/49445693#49445693
    """
    #
    la = len(arrays)
    dtype = np.result_type(*arrays)
    arr = np.empty((la, *map(len, arrays)), dtype=dtype)
    idx = slice(None), *itertools.repeat(None, la)
    for i, a in enumerate(arrays):
        arr[i, ...] = a[idx[: la - i]]
    return arr.reshape(la, -1).T
