"""Fast color transfer method using mean and std"""

from __future__ import annotations

from enum import Enum

import cv2
import numpy as np

__author__ = "Adrian Rosebrock"
__copyright__ = "Copyright 2014, Adrian Rosebrock"
__credits__ = ["Adrian Rosebrock", "theflyingzamboni"]
__license__ = "MIT"
__version__ = "1.0.0"
__maintainer__ = "Adrian Rosebrock"
__link__ = "https://github.com/jrosebr1/color_transfer"


class TransferColorSpace(Enum):
    LAB = "L*a*b*"
    RGB = "RGB"


class OverflowMethod(Enum):
    CLIP = 1
    SCALE = 0


def image_stats(img: np.ndarray):
    """Get means and standard deviations of channels"""

    # Compute the mean and standard deviation of each channel
    channel_a, channel_b, channel_c = cv2.split(img)
    a_mean, a_std = (channel_a.mean(), channel_a.std())
    b_mean, b_std = (channel_b.mean(), channel_b.std())
    c_mean, c_std = (channel_c.mean(), channel_c.std())

    # Return the color statistics
    return a_mean, a_std, b_mean, b_std, c_mean, c_std


def min_max_scale(img: np.ndarray, new_range=(0, 255)):
    """Perform min-max scaling to a NumPy array"""

    # Get arrays current min and max
    mn = img.min()
    mx = img.max()

    # Check if scaling needs to be done to be in new_range
    if mn < new_range[0] or mx > new_range[1]:
        # Perform min-max scaling
        range_diff = new_range[1] - new_range[0]
        scaled = range_diff * (img - mn) / (mx - mn) + new_range[0]
    else:
        # Return array if already in range
        scaled = img

    return scaled


def scale_array(
    arr: np.ndarray,
    overflow_method: OverflowMethod,
    clip_min: int = 0,
    clip_max: int = 255,
) -> np.ndarray:
    """
    Trim NumPy array values to be in [0, 255] range with option of
    clipping or scaling.
    """

    if overflow_method == OverflowMethod.CLIP:
        scaled = np.clip(arr, clip_min, clip_max)
    else:
        scale_range = (max([arr.min(), clip_min]), min([arr.max(), clip_max]))
        scaled = min_max_scale(arr, new_range=scale_range)

    return scaled


def color_transfer(
    img: np.ndarray,
    ref_img: np.ndarray,
    colorspace: TransferColorSpace,
    overflow_method: OverflowMethod,
    reciprocal_scale: bool = True,
) -> np.ndarray:
    """
    Transfers the color distribution from the source to the target image.
    Uses the mean and standard deviations of the specified
    colorspace. This implementation is (loosely) based on to the
    "Color Transfer between Images" paper by Reinhard et al., 2001.
    """

    a_clip_min, a_clip_max, b_clip_min, b_clip_max, c_clip_min, c_clip_max = (
        0,
        0,
        0,
        0,
        0,
        0,
    )

    # Convert the images from the RGB to L*a*b* color space, if necessary
    if colorspace == TransferColorSpace.LAB:
        a_clip_min, a_clip_max = (0, 100)
        b_clip_min, b_clip_max = (-127, 127)
        c_clip_min, c_clip_max = (-127, 127)
        img = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        ref_img = cv2.cvtColor(ref_img, cv2.COLOR_BGR2LAB)
    elif colorspace == TransferColorSpace.RGB:
        a_clip_min, a_clip_max = (0, 1)
        b_clip_min, b_clip_max = (0, 1)
        c_clip_min, c_clip_max = (0, 1)
        img = img[:, :, :3]
        ref_img = ref_img[:, :, :3]
    else:
        raise ValueError(f"Invalid color space {colorspace}")

    # Compute color statistics for the source and target images
    (
        a_mean_tar,
        a_std_tar,
        b_mean_tar,
        b_std_tar,
        c_mean_tar,
        c_std_tar,
    ) = image_stats(img)
    (
        a_mean_src,
        a_std_src,
        b_mean_src,
        b_std_src,
        c_mean_src,
        c_std_src,
    ) = image_stats(ref_img)

    # Subtract the means from the target image
    channel_a, channel_b, channel_c = cv2.split(img)
    channel_a -= a_mean_tar
    channel_b -= b_mean_tar
    channel_c -= c_mean_tar

    if reciprocal_scale:
        # Scale by the standard deviations using reciprocal of paper proposed factor
        channel_a = (a_std_src / a_std_tar) * channel_a
        channel_b = (b_std_src / b_std_tar) * channel_b
        channel_c = (c_std_src / c_std_tar) * channel_c
    else:
        # Scale by the standard deviations using paper proposed factor
        channel_a = (a_std_tar / a_std_src) * channel_a
        channel_b = (b_std_tar / b_std_src) * channel_b
        channel_c = (c_std_tar / c_std_src) * channel_c

    # Add in the source mean
    channel_a += a_mean_src
    channel_b += b_mean_src
    channel_c += c_mean_src

    # Clip/scale the pixel intensities to [clip_min, clip_max] if they fall
    # outside this range
    channel_a = scale_array(channel_a, overflow_method, a_clip_min, a_clip_max)
    channel_b = scale_array(channel_b, overflow_method, b_clip_min, b_clip_max)
    channel_c = scale_array(channel_c, overflow_method, c_clip_min, c_clip_max)

    # Merge the channels together, then convert back to the RGB color
    # space if necessary
    transfer = cv2.merge([channel_a, channel_b, channel_c])
    if colorspace == TransferColorSpace.LAB:
        transfer = cv2.cvtColor(transfer, cv2.COLOR_LAB2BGR)

    # Return the color transferred image
    return transfer
