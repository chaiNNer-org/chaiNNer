from typing import Tuple
import numpy as np


def get_opencv_formats():
    available_formats = []
    try:
        import cv2

        # Bitmaps
        available_formats.extend([".bmp", ".dib"])

        # JPEG
        available_formats.extend([".jpg", ".jpeg", ".jpe", ".jp2"])

        # PNG, WebP, Tiff
        available_formats.extend([".png", ".webp", ".tiff"])

        # Portable image format
        available_formats.extend([".pbm", ".pgm", ".ppm", ".pxm", ".pnm"])

        # Sun Rasters
        available_formats.extend([".sr", ".ras"])

        # OpenEXR
        available_formats.extend([".exr"])

        # Radiance HDR
        available_formats.extend([".hdr", ".pic"])
    except:
        print("OpenCV not installed")
    return available_formats


def get_pil_formats():
    available_formats = []
    try:
        from PIL import Image

        # Bitmaps
        available_formats.extend([".bmp", ".dib", ".xbm"])

        # DDS
        available_formats.extend([".dds"])

        # EPS
        available_formats.extend([".eps"])

        # GIF
        # available_formats.extend([".gif"])

        # Icons
        available_formats.extend([".icns", ".ico"])

        # JPEG
        available_formats.extend([".jpg", ".jpeg", ".jfif", ".jp2", ".jpx"])

        # Randoms
        available_formats.extend([".msp", ".pcx", ".sgi"])

        # PNG, WebP, TIFF
        available_formats.extend([".png", ".webp", ".tiff"])

        # APNG
        # available_formats.extend([".apng"])

        # Portable image format
        available_formats.extend([".pbm", ".pgm", ".ppm", ".pnm"])

        # TGA
        available_formats.extend([".tga"])
    except:
        print("Pillow not installed")
    return available_formats


def get_available_image_formats():
    available_formats = []
    available_formats.extend(get_opencv_formats())
    available_formats.extend(get_pil_formats())
    no_dupes = set(available_formats)
    return sorted(list(no_dupes))


def normalize_normals(
    x: np.ndarray, y: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    # the square of the length of X and Y
    l_sq = np.square(x) + np.square(y)

    # if the length of X and Y is >1, then we have make it 1
    l = np.sqrt(np.maximum(l_sq, 1))
    x /= l
    y /= l
    l_sq = np.minimum(l_sq, 1, out=l_sq)

    # compute Z
    z = np.sqrt(1 - l_sq)

    return x, y, z


def with_background(img: np.array, background: np.array):
    """Changes the given image to the background overlayed with the image."""
    assert img.ndim == 3 and img.shape[2] == 4, "The image has to be an RGBA image"
    assert (
        background.ndim == 3 and background.shape[2] == 4
    ), "The background has to be an RGBA image"

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
