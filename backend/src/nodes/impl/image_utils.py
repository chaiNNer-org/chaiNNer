from __future__ import annotations

import itertools
import math
import os
import random
import string
from enum import Enum

import cv2
import numpy as np

from ..utils.utils import Padding, get_h_w_c, split_file_path
from .color.color import Color

MAX_VALUES_BY_DTYPE = {
    np.dtype("int8").name: 127,
    np.dtype("uint8").name: 255,
    np.dtype("int16").name: 32767,
    np.dtype("uint16").name: 65535,
    np.dtype("int32").name: 2147483647,
    np.dtype("uint32").name: 4294967295,
    np.dtype("int64").name: 9223372036854775807,
    np.dtype("uint64").name: 18446744073709551615,
    np.dtype("float32").name: 1.0,
    np.dtype("float64").name: 1.0,
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
    WHITE = 6
    TRANSPARENT = 5
    CUSTOM_COLOR = 7


class NormalMapType(Enum):
    DIRECTX = "DirectX"
    OPENGL = "OpenGL"
    OCTAHEDRAL = "Octahedral"


def convert_to_bgra(img: np.ndarray, in_c: int) -> np.ndarray:
    assert in_c in (1, 3, 4), f"Number of channels ({in_c}) unexpected"
    if in_c == 1:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif in_c == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    return img.copy()


def _get_iinfo(img: np.ndarray) -> np.iinfo | None:
    try:
        return np.iinfo(img.dtype)
    except Exception:
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


def to_uint8(img: np.ndarray, normalized: bool = False) -> np.ndarray:
    """
    Returns a new uint8 image with the given image data.

    If `normalized` is `False`, then the image will be normalized before being converted to uint8.
    """
    if img.dtype == np.uint8:
        return img.copy()

    if not normalized or img.dtype != np.float32:
        img = normalize(img)

    return (img * 255).round().astype(np.uint8)


def to_uint16(img: np.ndarray, normalized: bool = False) -> np.ndarray:
    """
    Returns a new uint16 image with the given image data.

    If `normalized` is `False`, then the image will be normalized before being converted to uint16.
    """
    if img.dtype == np.uint16:
        return img.copy()

    if not normalized or img.dtype != np.float32:
        img = normalize(img)

    return (img * 65535).round().astype(np.uint16)


class ShiftFill(Enum):
    AUTO = -1
    BLACK = 0
    TRANSPARENT = 1
    WRAP = 2

    def to_fill_color(self) -> FillColor:
        if self == ShiftFill.AUTO:
            return FillColor.AUTO
        elif self == ShiftFill.BLACK:
            return FillColor.BLACK
        elif self == ShiftFill.TRANSPARENT:
            return FillColor.TRANSPARENT
        raise ValueError(f"Cannot get color for {self}")


def shift(
    img: np.ndarray, amount_x: int, amount_y: int, shift_fill: ShiftFill
) -> np.ndarray:
    h, w, c = get_h_w_c(img)

    if shift_fill == ShiftFill.WRAP:
        amount_x %= w
        amount_y %= h

        if amount_x != 0:
            img = np.roll(img, amount_x, axis=1)
        if amount_y != 0:
            img = np.roll(img, amount_y, axis=0)

        return img

    fill = shift_fill.to_fill_color()
    if fill == FillColor.TRANSPARENT:
        img = convert_to_bgra(img, c)
    fill_color = fill.get_color(c)

    h, w, _ = get_h_w_c(img)
    translation_matrix = np.asfarray(
        [[1, 0, amount_x], [0, 1, amount_y]], dtype=np.float32
    )
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
    raise AssertionError(f"Invalid image shape {img.shape}")


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
    color: Color | None = None,
) -> np.ndarray:
    """
    Returns a new image with a specified border.
    """

    if border.empty:
        return img

    _, _, c = get_h_w_c(img)
    if c == 4 and border_type == BorderType.BLACK:
        value = (0.0, 0.0, 0.0, 1.0)
    else:
        value = (0.0,)

    cv_border_type: int = border_type.value
    if border_type == BorderType.TRANSPARENT:
        cv_border_type = cv2.BORDER_CONSTANT
        value = (0.0,)
        img = as_target_channels(img, 4)
    elif border_type == BorderType.WHITE:
        cv_border_type = cv2.BORDER_CONSTANT
        value = (1.0,) * c
    elif border_type == BorderType.CUSTOM_COLOR:
        assert (
            color is not None
        ), "Creating a border with a custom color requires supplying a custom color."

        # widen image or color to make them compatible
        if color.channels > c:
            img = as_target_channels(img, color.channels)
        elif c > color.channels:
            color = Color.from_1x1_image(as_target_channels(color.to_1x1_image(), c))

        cv_border_type = cv2.BORDER_CONSTANT
        value = color.value

    return cv2.copyMakeBorder(
        img,
        top=border.top,
        left=border.left,
        right=border.right,
        bottom=border.bottom,
        borderType=cv_border_type,
        value=value,
    )


def calculate_ssim(
    img1: np.ndarray,
    img2: np.ndarray,
) -> float:
    """Calculates mean localized Structural Similarity Index (SSIM)
    between two images."""

    c1 = 0.01**2
    c2 = 0.03**2

    kernel = cv2.getGaussianKernel(11, 1.5)
    window = np.outer(kernel, kernel.transpose())  # type: ignore

    mu1 = cv2.filter2D(img1, -1, window)[5:-5, 5:-5]
    mu2 = cv2.filter2D(img2, -1, window)[5:-5, 5:-5]
    mu1_sq = np.power(mu1, 2)
    mu2_sq = np.power(mu2, 2)
    mu1_mu2 = np.multiply(mu1, mu2)
    sigma1_sq = cv2.filter2D(img1**2, -1, window)[5:-5, 5:-5] - mu1_sq
    sigma2_sq = cv2.filter2D(img2**2, -1, window)[5:-5, 5:-5] - mu2_sq
    sigma12 = cv2.filter2D(img1 * img2, -1, window)[5:-5, 5:-5] - mu1_mu2

    ssim_map = ((2 * mu1_mu2 + c1) * (2 * sigma12 + c2)) / (
        (mu1_sq + mu2_sq + c1) * (sigma1_sq + sigma2_sq + c2)
    )

    return float(np.mean(ssim_map))


def cv_save_image(path: str, img: np.ndarray, params: list[int]):
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
        except Exception:
            _, buf_img = cv2.imencode(f".{extension}", img, params)
            with open(path, "wb") as outf:
                outf.write(buf_img)  # type: ignore


def cartesian_product(arrays: list[np.ndarray]) -> np.ndarray:
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


def fast_gaussian_blur(
    img: np.ndarray,
    sigma_x: float,
    sigma_y: float | None = None,
) -> np.ndarray:
    """
    Computes a channel-wise gaussian blur of the given image using a fast approximation.

    The maximum error of the approximation is guaranteed to be less than 0.1%.
    In addition to that, the error is guaranteed to be smoothly distributed across the image.
    There are no sudden spikes in error anywhere.

    Specifically, the method is implemented by downsampling the image, blurring the downsampled
    image, and then upsampling the blurred image. This is much faster than blurring the full image.
    Unfortunately, OpenCV's `resize` method has unfortunate artifacts when upscaling, so we
    apply a small gaussian blur to the image after upscaling to smooth out the artifacts. This
    single step almost doubles the runtime of the method, but it is still much faster than
    blurring the full image.
    """
    if sigma_y is None:
        sigma_y = sigma_x
    if sigma_x == 0 or sigma_y == 0:
        return img.copy()

    h, w, _ = get_h_w_c(img)

    def get_scale_factor(sigma: float) -> float:
        if sigma < 11:
            return 1
        if sigma < 15:
            return 1.25
        if sigma < 20:
            return 1.5
        if sigma < 25:
            return 2
        if sigma < 30:
            return 2.5
        if sigma < 50:
            return 3
        if sigma < 100:
            return 4
        if sigma < 200:
            return 6
        return 8

    def get_sizing(size: int, sigma: float, f: float) -> tuple[int, float, float]:
        """
        Return the size of the downsampled image, the sigma of the downsampled gaussian blur,
        and the sigma of the upscaled gaussian blur.
        """
        if f <= 1:
            # just use simple gaussian, the error is too large otherwise
            return size, 0, sigma

        size_down = math.ceil(size / f)
        f = size / size_down
        sigma_up = f
        sigma_down = math.sqrt(sigma**2 - sigma_up**2) / f
        return size_down, sigma_down, sigma_up

    # Handling different sigma values for x and y is difficult, so we take the easy way out
    # and just use the smaller one. There are potentially better ways of combining them, but
    # this is good enough for now.
    scale_factor = min(get_scale_factor(sigma_x), get_scale_factor(sigma_y))
    h_down, y_down_sigma, y_up_sigma = get_sizing(h, sigma_y, scale_factor)
    w_down, x_down_sigma, x_up_sigma = get_sizing(w, sigma_x, scale_factor)

    if h != h_down or w != w_down:
        # downsampled gaussian blur
        img = cv2.resize(img, (w_down, h_down), interpolation=cv2.INTER_AREA)
        img = cv2.GaussianBlur(
            img,
            (0, 0),
            sigmaX=x_down_sigma,
            sigmaY=y_down_sigma,
            borderType=cv2.BORDER_REFLECT,
        )
        img = cv2.resize(img, (w, h), interpolation=cv2.INTER_LINEAR)

    if x_up_sigma != 0 or y_up_sigma != 0:
        # post blur to smooth out artifacts
        img = cv2.GaussianBlur(
            img,
            (0, 0),
            sigmaX=x_up_sigma,
            sigmaY=y_up_sigma,
            borderType=cv2.BORDER_REFLECT,
        )

    return img
