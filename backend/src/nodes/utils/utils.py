# From https://github.com/victorca25/iNNfer/blob/main/utils/utils.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Tuple, Type, Union
import re
import os
import cv2

import numpy as np
from sanic.log import logger

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
NUMBERS = re.compile(r"(\d+)")

ALPHABET = [*"ABCDEFGHIJKLMNOPQRSTUVWXYZ"]


def round_half_up(number: Union[float, int]) -> int:
    """
    Python's `round` method implements round-half-to-even rounding which is very unintuitive.
    This function implements round-half-up rounding.

    Round half up is consistent with JavaScript's `Math.round`.

    https://en.wikipedia.org/wiki/Rounding#Rounding_to_the_nearest_integer
    """
    return int(number + 0.5)


def get_h_w_c(image: np.ndarray) -> Tuple[int, int, int]:
    """Returns the height, width, and number of channels."""
    h, w = image.shape[:2]
    c = 1 if image.ndim == 2 else image.shape[2]
    return h, w, c


def denorm(x: np.ndarray, min_max: Tuple[float, float] = (-1.0, 1.0)) -> np.ndarray:
    """Denormalize from [-1,1] range to [0,1]
    formula: xi' = (xi - mu)/sigma
    Example: "out = (x + 1.0) / 2.0" for denorm
        range (-1,1) to (0,1)
    for use with proper act in Generator output (ie. tanh)
    """
    out = (x - min_max[0]) / (min_max[1] - min_max[0])
    return np.clip(out, 0, 1)


def norm(x: np.ndarray) -> np.ndarray:
    """Normalize (z-norm) from [0,1] range to [-1,1]"""
    out = (x - 0.5) * 2.0
    return np.clip(out, -1, 1)


def np_bgr_to_rgb(image: np.ndarray) -> np.ndarray:
    out: np.ndarray = image[::-1, ...]
    return out


def np_rgb_to_bgr(image: np.ndarray) -> np.ndarray:
    # same operation as bgr_to_rgb(), flip image channels
    return np_bgr_to_rgb(image)


def np_bgra_to_rgba(image: np.ndarray) -> np.ndarray:
    out: np.ndarray = image[[2, 1, 0, 3], ...]  # type: ignore
    return out


def np_rgba_to_bgra(image: np.ndarray) -> np.ndarray:
    # same operation as bgra_to_rgba(), flip image channels
    return np_bgra_to_rgba(image)


def np2nptensor(
    img: np.ndarray,
    bgr2rgb=True,
    data_range=1.0,  # pylint: disable=unused-argument
    normalize=False,
    change_range=True,
    add_batch=True,
) -> np.ndarray:
    """Converts a numpy image array into a numpy Tensor array.
    Parameters:
        img (numpy array): the input image numpy array
        add_batch (bool): choose if new tensor needs batch dimension added
    """
    if not isinstance(img, np.ndarray):  # images expected to be uint8 -> 255
        raise TypeError("Got unexpected object type, expected np.ndarray")
    # check how many channels the image has, then condition. ie. RGB, RGBA, Gray
    # if bgr2rgb:
    #     img = img[
    #         :, :, [2, 1, 0]
    #     ]  # BGR to RGB -> in numpy, if using OpenCV, else not needed. Only if image has colors.
    if change_range:
        dtype = img.dtype
        maxval = MAX_VALUES_BY_DTYPE.get(dtype, 1.0)
        t_dtype = np.dtype("float32")
        img = img.astype(t_dtype) / maxval  # ie: uint8 = /255
    # "HWC to CHW" and "numpy to tensor"
    img = np.ascontiguousarray(np.transpose(img, (2, 0, 1))).astype(np.float32)
    if bgr2rgb:
        # BGR to RGB -> in tensor, if using OpenCV, else not needed. Only if image has colors.)
        if (
            img.shape[0] % 3 == 0
        ):  # RGB or MultixRGB (3xRGB, 5xRGB, etc. For video tensors.)
            img = np_bgr_to_rgb(img)
        elif img.shape[0] == 4:  # RGBA
            img = np_bgra_to_rgba(img)
    if add_batch:
        img = np.expand_dims(
            img, axis=0
        )  # Add fake batch dimension = 1 . squeeze() will remove the dimensions of size 1
    if normalize:
        img = norm(img)
    return img


def nptensor2np(
    img: np.ndarray,
    rgb2bgr=True,
    remove_batch=True,
    data_range=255,
    denormalize=False,
    change_range=True,
    imtype: Type = np.uint8,
) -> np.ndarray:
    """Converts a Tensor array into a numpy image array.
    Parameters:
        img (tensor): the input image tensor array
            4D(B,(3/1),H,W), 3D(C,H,W), or 2D(H,W), any range, RGB channel order
        remove_batch (bool): choose if tensor of shape BCHW needs to be squeezed
        denormalize (bool): Used to denormalize from [-1,1] range back to [0,1]
        imtype (type): the desired type of the converted numpy array (np.uint8
            default)
    Output:
        img (np array): 3D(H,W,C) or 2D(H,W), [0,255], np.uint8 (default)
    """
    n_dim = img.ndim

    img = img.astype(np.float32)

    if n_dim in (4, 3):
        # if n_dim == 4, has to convert to 3 dimensions
        if n_dim == 4 and remove_batch:
            # remove a fake batch dimension
            img = img.squeeze(0)

        if img.shape[0] == 3 and rgb2bgr:  # RGB
            # RGB to BGR -> in tensor, if using OpenCV, else not needed. Only if image has colors.
            img_np = np_rgb_to_bgr(img)
        elif img.shape[0] == 4 and rgb2bgr:  # RGBA
            # RGBA to BGRA -> in tensor, if using OpenCV, else not needed. Only if image has colors.
            img_np = np_rgba_to_bgra(img)
        else:
            img_np = img
        img_np = np.transpose(img_np, (1, 2, 0))  # CHW to HWC
    elif n_dim == 2:
        img_np = img
    else:
        raise TypeError(
            f"Only support 4D, 3D and 2D tensor. But received with dimension: {n_dim:d}"
        )

    # if rgb2bgr:
    # img_np = img_np[[2, 1, 0], :, :] #RGB to BGR -> in numpy, if using OpenCV, else not needed. Only if image has colors.
    # TODO: Check: could denormalize in the begining in tensor form instead
    if denormalize:
        img_np = denorm(img_np)  # denormalize if needed
    if change_range:
        img_np = np.clip(
            data_range * img_np, 0, data_range
        ).round()  # np.clip to the data_range

    # has to be in range (0,255) before changing to np.uint8, else np.float32
    return img_np.astype(imtype)


def clipped(upscale: Callable[[np.ndarray], np.ndarray]) -> Callable:
    return lambda i: np.clip(upscale(i), 0, 1)


def to_target_channels(img: np.ndarray, target: int) -> np.ndarray:
    """Adjusts the given image to have `target` number of channels."""
    c = get_h_w_c(img)[2]

    if c == target:
        if img.ndim == 2:
            return np.expand_dims(img.copy(), axis=2)
        return img

    if c == 1:
        if target == 3:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        if target == 4:
            return cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)

    if c == 3:
        if target == 1:
            return np.expand_dims(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), axis=2)
        if target == 4:
            return cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    if c == 4:
        if target == 1:
            return np.expand_dims(cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY), axis=2)
        if target == 3:
            return cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

    raise ValueError(f"Unable to convert {c} channel image to {target} channel image")


def with_black_and_white_backgrounds(img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    c = get_h_w_c(img)[2]
    assert c == 4

    black = np.copy(img[:, :, :3])
    white = np.copy(img[:, :, :3])
    for c in range(3):
        black[:, :, c] *= img[:, :, 3]
        white[:, :, c] = (white[:, :, c] - 1) * img[:, :, 3] + 1

    return black, white


def convenient_upscale(
    img: np.ndarray,
    model_in_nc: int,
    model_out_nc: int,
    upscale: Callable[[np.ndarray], np.ndarray],
) -> np.ndarray:
    """
    Upscales the given image in an intuitive/convenient way.

    This method guarantees that the `upscale` function will be called with an image with
    `model_in_nc` number of channels.

    Additionally, guarantees that the number of channels of the output image will match
    that of the input image in cases where `model_in_nc` == `model_out_nc`, and match
    `model_out_nc` otherwise.
    """
    in_img_c = get_h_w_c(img)[2]

    upscale = clipped(upscale)

    if model_in_nc != model_out_nc:
        return upscale(to_target_channels(img, model_in_nc))

    if in_img_c == model_in_nc:
        return upscale(img)

    if in_img_c == 4:
        # Ignore alpha if single-color or not being replaced
        unique = np.unique(img[:, :, 3])
        if len(unique) == 1:
            rgb = to_target_channels(
                upscale(to_target_channels(img[:, :, :3], model_in_nc)), 3
            )
            unique_alpha = np.full(rgb.shape[:-1], unique[0], np.float32)
            return np.dstack((rgb, unique_alpha))

        # Transparency hack (white/black background difference alpha)
        black, white = with_black_and_white_backgrounds(img)
        black_up = to_target_channels(
            upscale(to_target_channels(black, model_in_nc)), 3
        )
        white_up = to_target_channels(
            upscale(to_target_channels(white, model_in_nc)), 3
        )

        alpha = 1 - np.mean(white_up - black_up, axis=2)
        return np.dstack((black_up, alpha))

    return to_target_channels(upscale(to_target_channels(img, model_in_nc)), in_img_c)


def resize_to_side_conditional(
    w: int, h: int, target: int, side: str, condition: str
) -> Tuple[int, int]:
    def compare_conditions(b: int) -> bool:
        if condition == "both":
            return False
        if condition == "downscale":
            return target > b
        elif condition == "upscale":
            return target < b
        else:
            raise RuntimeError(f"Unknown condition {condition}")

    if side == "width":
        if compare_conditions(w):
            w_new = w
            h_new = h
        else:
            w_new = target
            h_new = max(round_half_up((target / w) * h), 1)

    elif side == "height":
        if compare_conditions(h):
            w_new = w
            h_new = h
        else:
            w_new = max(round_half_up((target / h) * w), 1)
            h_new = target

    elif side == "shorter side":
        if compare_conditions(min(h, w)):
            w_new = w
            h_new = h
        else:
            w_new = max(round_half_up((target / min(h, w)) * w), 1)
            h_new = max(round_half_up((target / min(h, w)) * h), 1)

    elif side == "longer side":
        if compare_conditions(max(h, w)):
            w_new = w
            h_new = h
        else:
            w_new = max(round_half_up((target / max(h, w)) * w), 1)
            h_new = max(round_half_up((target / max(h, w)) * h), 1)

    else:
        raise RuntimeError(f"Unknown side selection {side}")

    return w_new, h_new


def alphanumeric_sort(value: str) -> List[Union[str, int]]:
    """Key function to sort strings containing numbers by proper
    numerical order."""

    lcase_value = value.upper()
    parts = NUMBERS.split(lcase_value)
    parts[1::2] = map(int, parts[1::2])
    return parts  # type: ignore


def walk_error_handler(exception_instance):
    logger.warning(
        f"Exception occurred during walk: {exception_instance} Continuing..."
    )


def list_all_files_sorted(
    directory: str, ext_filter: Union[List[str], None] = None
) -> List[str]:
    just_files: List[str] = []
    for root, dirs, files in os.walk(
        directory, topdown=True, onerror=walk_error_handler
    ):
        dirs.sort(key=alphanumeric_sort)
        for name in sorted(files, key=alphanumeric_sort):
            filepath = os.path.join(root, name)
            _base, ext = os.path.splitext(filepath)
            if ext_filter is None or ext.lower() in ext_filter:
                just_files.append(filepath)
    return just_files


@dataclass(frozen=True)
class Padding:
    top: int
    right: int
    bottom: int
    left: int

    @staticmethod
    def all(value: int) -> "Padding":
        return Padding(value, value, value, value)

    @staticmethod
    def to(value: Padding | int) -> Padding:
        if isinstance(value, int):
            return Padding.all(value)
        return value

    @property
    def horizontal(self) -> int:
        return self.left + self.right

    @property
    def vertical(self) -> int:
        return self.top + self.bottom

    @property
    def empty(self) -> bool:
        return self.top == 0 and self.right == 0 and self.bottom == 0 and self.left == 0

    def scale(self, factor: int) -> Padding:
        return Padding(
            self.top * factor,
            self.right * factor,
            self.bottom * factor,
            self.left * factor,
        )

    def min(self, other: Padding | int) -> Padding:
        other = Padding.to(other)
        return Padding(
            min(self.top, other.top),
            min(self.right, other.right),
            min(self.bottom, other.bottom),
            min(self.left, other.left),
        )

    def remove_from(self, image: np.ndarray) -> np.ndarray:
        h, w, _ = get_h_w_c(image)

        return image[
            self.top : (h - self.bottom),
            self.left : (w - self.right),
            ...,
        ]


@dataclass(frozen=True)
class Region:
    x: int
    y: int
    width: int
    height: int

    @property
    def size(self) -> Tuple[int, int]:
        return self.width, self.height

    def scale(self, factor: int) -> Region:
        return Region(
            self.x * factor,
            self.y * factor,
            self.width * factor,
            self.height * factor,
        )

    def intersect(self, other: Region) -> Region:
        x = max(self.x, other.x)
        y = max(self.y, other.y)
        width = min(self.x + self.width, other.x + other.width) - x
        height = min(self.y + self.height, other.y + other.height) - y
        return Region(x, y, width, height)

    def add_padding(self, pad: Padding) -> Region:
        return Region(
            x=self.x - pad.left,
            y=self.y - pad.top,
            width=self.width + pad.horizontal,
            height=self.height + pad.vertical,
        )

    def remove_padding(self, pad: Padding) -> Region:
        return self.add_padding(pad.scale(-1))

    def child_padding(self, child: Region) -> Padding:
        """
        Returns the padding `p` such that `child.add_padding(p) == self`.
        """
        left = child.x - self.x
        top = child.y - self.y
        right = self.width - child.width - left
        bottom = self.height - child.height - top
        return Padding(top, right, bottom, left)

    def read_from(self, image: np.ndarray) -> np.ndarray:
        h, w, _ = get_h_w_c(image)
        if (w, h) == self.size:
            return image

        return image[
            self.y : (self.y + self.height),
            self.x : (self.x + self.width),
            ...,
        ]

    def write_into(self, lhs: np.ndarray, rhs: np.ndarray):
        h, w, _ = get_h_w_c(rhs)
        assert (w, h) == self.size

        lhs[
            self.y : (self.y + self.height),
            self.x : (self.x + self.width),
            ...,
        ] = rhs
