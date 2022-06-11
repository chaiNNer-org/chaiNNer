from typing import Tuple

import cv2
import numpy as np
from sanic.log import logger

from .blend_modes import ImageBlender
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


def blend_images(ov: np.ndarray, base: np.ndarray, blend_mode: int):
    """Changes the given image to the background overlayed with the image."""
    assert get_h_w_c(ov)[2] == 4, "The image has to be an RGBA image"
    assert get_h_w_c(base)[2] == 4, "The background has to be an RGBA image"

    ov_a = ov[:, :, 3]
    base_a = base[:, :, 3]
    combined_a = 1 - (1 - ov_a) * (1 - base_a)

    blender = ImageBlender()
    ov[:, :, 0] = (
        ((ov_a - ov_a * base_a) * ov[:, :, 0])
        + ((base_a - ov_a * base_a) * base[:, :, 0])
        + (ov_a * base_a * blender.apply_blend(ov[:, :, 0], base[:, :, 0], blend_mode))
    )  # type: ignore
    ov[:, :, 1] = (
        ((ov_a - ov_a * base_a) * ov[:, :, 1])
        + ((base_a - ov_a * base_a) * base[:, :, 1])
        + (ov_a * base_a * blender.apply_blend(ov[:, :, 1], base[:, :, 1], blend_mode))
    )  # type: ignore
    ov[:, :, 2] = (
        ((ov_a - ov_a * base_a) * ov[:, :, 2])
        + ((base_a - ov_a * base_a) * base[:, :, 2])
        + (ov_a * base_a * blender.apply_blend(ov[:, :, 2], base[:, :, 2], blend_mode))
    )  # type: ignore

    ov[:, :, :3] = ov[:, :, :3] / np.maximum(np.dstack((combined_a,) * 3), 0.0001)
    ov[:, :, 3] = combined_a

    return ov


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

    return np.mean(ssim_map)
