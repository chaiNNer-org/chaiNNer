# pylint: skip-file
# From https://github.com/victorca25/iNNfer/blob/main/utils/utils.py
from __future__ import annotations

from typing import Callable, List, Tuple, Type, Union
import cv2
import re

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
    out: np.ndarray = image[[2, 1, 0, 3], ...]
    return out


def np_rgba_to_bgra(image: np.ndarray) -> np.ndarray:
    # same operation as bgra_to_rgba(), flip image channels
    return np_bgra_to_rgba(image)


def np2nptensor(
    img: np.ndarray,
    bgr2rgb=True,
    data_range=1.0,
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


def convenient_upscale(
    img: np.ndarray,
    input_channels: int,
    upscale: Callable[[np.ndarray], np.ndarray],
) -> np.ndarray:
    """
    Upscales the given image in an intuitive/convenient way.

    This method guarantees that the `upscale` function will be called with an image with
    `input_channels` number of channels.
    """

    c = get_h_w_c(img)[2]

    # Transparency hack (white/black background difference alpha)
    if c == 4 and input_channels in (1, 3):
        # Ignore single-color alpha
        unique = np.unique(img[:, :, 3])
        if len(unique) == 1:
            logger.info("Single color alpha channel, ignoring.")
            if input_channels == 1:
                logger.warning("Converting image to grayscale.")
                img = np.expand_dims(cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY), axis=2)
            else:
                img = img[:, :, :3]
            output = upscale(img)
            if input_channels == 1:
                output = np.tile(output, (1, 1, 3))
            output = np.dstack(
                (output, np.full(output.shape[:-1], unique[0], np.float32))
            )
        else:
            img1 = np.copy(img[:, :, :3])
            img2 = np.copy(img[:, :, :3])
            for c in range(3):
                img1[:, :, c] *= img[:, :, 3]
                img2[:, :, c] = (img2[:, :, c] - 1) * img[:, :, 3] + 1

            if input_channels == 1:
                logger.warning("Converting image to grayscale.")
                img1 = np.expand_dims(cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY), axis=2)
                img2 = np.expand_dims(cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY), axis=2)
            output1 = upscale(img1)
            output2 = upscale(img2)
            alpha = 1 - np.mean(output2 - output1, axis=2)  # type: ignore
            if input_channels == 1:
                output1 = np.tile(output1, (1, 1, 3))
            output = np.dstack((output1, alpha))
    else:
        # Add extra channels if not enough (i.e single channel img, three channel model)
        gray = False
        if c == 1:
            gray = True
            logger.debug("Expanding image channels if necessary.")
            if img.ndim == 2:
                img = np.tile(
                    np.expand_dims(img, axis=2), (1, 1, min(input_channels, 3))
                )
            else:
                img = np.tile(img, (1, 1, min(input_channels, 3)))
            if input_channels == 4:
                img = np.dstack((img, np.full(img.shape[:-1], 1.0, np.float32)))
        # Remove extra channels if too many (i.e three channel image, single channel model)
        elif c == 3:
            if input_channels == 1:
                logger.warning("Converting image to grayscale.")
                img = np.expand_dims(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), axis=2)
            # Pad with solid alpha channel if needed (i.e three channel image, four channel model)
            elif input_channels == 4:
                logger.debug("Expanding image channels.")
                img = np.dstack((img, np.full(img.shape[:-1], 1.0, np.float32)))

        output = upscale(img)

        if gray:
            out_c = get_h_w_c(output)[2]
            if out_c == 4:
                output = output[:, :, :3]
            if out_c > 1:
                output = np.expand_dims(
                    cv2.cvtColor(output, cv2.COLOR_BGR2GRAY), axis=2
                )

    return np.clip(output, 0, 1)


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
            h_new = max(round((target / w) * h), 1)

    elif side == "height":
        if compare_conditions(h):
            w_new = w
            h_new = h
        else:
            w_new = max(round((target / h) * w), 1)
            h_new = target

    elif side == "shorter side":
        if compare_conditions(min(h, w)):
            w_new = w
            h_new = h
        else:
            w_new = max(round((target / min(h, w)) * w), 1)
            h_new = max(round((target / min(h, w)) * h), 1)

    elif side == "longer side":
        if compare_conditions(max(h, w)):
            w_new = w
            h_new = h
        else:
            w_new = max(round((target / max(h, w)) * w), 1)
            h_new = max(round((target / max(h, w)) * h), 1)

    else:
        raise RuntimeError(f"Unknown side selection {side}")

    return w_new, h_new


def numerical_sort(value: str) -> List[Union[str, int]]:
    """Key function to sort strings containing numbers by proper
    numerical order."""

    parts = NUMBERS.split(value)
    parts[1::2] = map(int, parts[1::2])
    return parts  # type: ignore
