from typing import Tuple

import numpy as np
from sanic.log import logger

from .utils import get_h_w_c


def get_opencv_formats():
    available_formats = [
        # Bitmaps
        ".bmp",
        ".dib",
        # JPEG
        ".jpg",
        ".jpeg",
        ".jpe",
        ".jp2",
        # PNG, WebP, Tiff
        ".png",
        ".webp",
        ".tiff",
        # Portable image format
        ".pbm",
        ".pgm",
        ".ppm",
        ".pxm",
        ".pnm",
        # Sun Rasters
        ".sr",
        ".ras",
        # OpenEXR
        ".exr",
        # Radiance HDR
        ".hdr",
        ".pic",
    ]
    return available_formats


def get_pil_formats():
    available_formats = [
        # Bitmaps
        ".bmp",
        ".dib",
        ".xbm",
        # DDS
        ".dds",
        # EPS
        ".eps",
        # GIF
        # ".gif",
        # Icons
        ".icns",
        ".ico",
        # JPEG
        ".jpg",
        ".jpeg",
        ".jfif",
        ".jp2",
        ".jpx",
        # Randoms
        ".msp",
        ".pcx",
        ".sgi",
        # PNG, WebP, TIFF
        ".png",
        ".webp",
        ".tiff",
        # APNG
        # ".apng",
        # Portable image format
        ".pbm",
        ".pgm",
        ".ppm",
        ".pnm",
        # TGA
        ".tga",
    ]

    return available_formats


def get_available_image_formats():
    available_formats = []
    available_formats.extend(get_opencv_formats())
    available_formats.extend(get_pil_formats())
    no_dupes = set(available_formats)
    return sorted(list(no_dupes))


def normalize(img: np.ndarray) -> np.ndarray:
    dtype_max = 1
    try:
        dtype_max = np.iinfo(img.dtype).max
    except:
        logger.debug("img dtype is not int")
    return np.clip(img.astype(np.float32) / dtype_max, 0, 1)


def normalize_normals(
    x: np.ndarray, y: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    # The square of the length of X and Y
    l_sq = np.square(x) + np.square(y)

    # If the length of X and Y is >1, then make it 1
    l = np.sqrt(np.maximum(l_sq, 1))
    x /= l
    y /= l
    l_sq = np.minimum(l_sq, 1, out=l_sq)

    # Compute Z
    z = np.sqrt(1 - l_sq)

    return x, y, z


def with_background(img: np.ndarray, background: np.ndarray):
    """Changes the given image to the background overlayed with the image."""
    assert get_h_w_c(img)[2] == 4, "The image has to be an RGBA image"
    assert get_h_w_c(background)[2] == 4, "The background has to be an RGBA image"

    a = 1 - (1 - img[:, :, 3]) * (1 - background[:, :, 3])
    img_blend = img[:, :, 3] / np.maximum(a, 0.0001)

    img[:, :, 0] *= img_blend
    img[:, :, 1] *= img_blend
    img[:, :, 2] *= img_blend
    img_blend = 1 - img_blend
    img[:, :, 0] += background[:, :, 0] * img_blend
    img[:, :, 1] += background[:, :, 1] * img_blend
    img[:, :, 2] += background[:, :, 2] * img_blend
    img[:, :, 3] = a
