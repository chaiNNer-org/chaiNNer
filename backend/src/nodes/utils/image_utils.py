import base64
from typing import Tuple

import cv2
import numpy as np
from sanic.log import logger

from .blend_modes import ImageBlender, blend_mode_normalized
from .utils import get_h_w_c, Padding


class FillColor:
    AUTO = -1
    BLACK = 0
    TRANSPARENT = 1


class FlipAxis:
    HORIZONTAL = 1
    VERTICAL = 0
    BOTH = -1
    NONE = 2


class BorderType:
    BLACK = 0
    REPLICATE = 1
    WRAP = 3
    REFLECT_MIRROR = 4
    TRANSPARENT = 5


class KernelType:
    NORMAL = 0
    STRONG = 1


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
        ".tif",
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


def convert_to_BGRA(img: np.ndarray, in_c: int) -> np.ndarray:
    assert in_c in (1, 3, 4), f"Number of channels ({in_c}) unexpected"
    if in_c == 1:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif in_c == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    return img.copy()


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


def get_fill_color(channels: int, fill: int):
    """Select how to fill negative space that results from rotation"""

    if fill == FillColor.AUTO:
        fill_color = (0,) * channels
    elif fill == FillColor.BLACK:
        fill_color = (0,) * channels if channels < 4 else (0, 0, 0, 1)
    else:
        fill_color = (0, 0, 0, 0)

    return fill_color


def shift(img: np.ndarray, amount_x: int, amount_y: int, fill: int) -> np.ndarray:
    c = get_h_w_c(img)[2]
    if fill == FillColor.TRANSPARENT:
        img = convert_to_BGRA(img, c)
    fill_color = get_fill_color(c, fill)

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


def as_target_channels(img: np.ndarray, target_channels: int) -> np.ndarray:
    """
    Given a number of target channels (either 1, 3, or 4), this convert the given image
    to an image with that many channels. If the given image already has the correct
    number of channels, it will be returned as is.

    Only widening conversions are supported.
    """
    c = get_h_w_c(img)[2]

    if target_channels == 1:
        return as_2d_grayscale(img)
    if c == target_channels:
        return img

    assert c < target_channels

    if target_channels == 3:
        if c == 1:
            img = as_2d_grayscale(img)
            return np.dstack((img, img, img))

    if target_channels == 4:
        return convert_to_BGRA(img, c)

    assert False, "Unable to convert image"


def create_border(
    img: np.ndarray,
    border_type: int,
    border: Padding,
) -> np.ndarray:
    """
    Returns a new image with a specified border.

    The border type value is expected to come from the `BorderType` class.
    """

    if border.empty:
        return img

    _, _, c = get_h_w_c(img)
    if c == 4 and border_type == BorderType.BLACK:
        value = (0, 0, 0, 1)
    else:
        value = 0

    if border_type == BorderType.TRANSPARENT:
        border_type = cv2.BORDER_CONSTANT
        value = 0
        img = as_target_channels(img, 4)

    return cv2.copyMakeBorder(
        img,
        top=border.top,
        left=border.left,
        right=border.right,
        bottom=border.bottom,
        borderType=border_type,
        value=value,
    )


def blend_images(overlay: np.ndarray, base: np.ndarray, blend_mode: int):
    """
    Changes the given image to the background overlayed with the image.

    The 2 given images must be the same size and their values must be between 0 and 1.

    The returned image is guaranteed to have values between 0 and 1.

    If the 2 given images have a different number of channels, then the returned image
    will have maximum of the two.

    Only grayscale, RGB, and RGBA images are supported.
    """
    o_shape = get_h_w_c(overlay)
    b_shape = get_h_w_c(base)

    assert (
        o_shape[:2] == b_shape[:2]
    ), "The overlay and the base image must have the same size"

    def assert_sane(c: int, name: str):
        sane = c in (1, 3, 4)
        assert sane, f"The {name} has to be a grayscale, RGB, or RGBA image"

    o_channels = o_shape[2]
    b_channels = b_shape[2]

    assert_sane(o_channels, "overlay layer")
    assert_sane(b_channels, "base layer")

    blender = ImageBlender()
    target_c = max(o_channels, b_channels)
    needs_clipping = not blend_mode_normalized(blend_mode)

    if target_c == 4 and b_channels < 4:
        base = as_target_channels(base, 3)

        # The general algorithm below can be optimized because we know that b_a is 1
        o_a = np.dstack((overlay[:, :, 3],) * 3)
        o_rgb = overlay[:, :, :3]

        blend_rgb = blender.apply_blend(o_rgb, base, blend_mode)
        final_rgb = o_a * blend_rgb + (1 - o_a) * base
        if needs_clipping:
            final_rgb = np.clip(final_rgb, 0, 1)

        return as_target_channels(final_rgb, 4)

    overlay = as_target_channels(overlay, target_c)
    base = as_target_channels(base, target_c)

    if target_c in (1, 3):
        # We don't need to do any alpha blending, so the images can blended directly
        result = blender.apply_blend(overlay, base, blend_mode)
        if needs_clipping:
            result = np.clip(result, 0, 1)
        return result

    # do the alpha blending for RGBA
    o_a = overlay[:, :, 3]
    b_a = base[:, :, 3]
    o_rgb = overlay[:, :, :3]
    b_rgb = base[:, :, :3]

    final_a = 1 - (1 - o_a) * (1 - b_a)

    blend_strength = o_a * b_a
    o_strength = o_a - blend_strength  # type: ignore
    b_strength = b_a - blend_strength  # type: ignore

    blend_rgb = blender.apply_blend(o_rgb, b_rgb, blend_mode)

    final_rgb = (
        (np.dstack((o_strength,) * 3) * o_rgb)
        + (np.dstack((b_strength,) * 3) * b_rgb)
        + (np.dstack((blend_strength,) * 3) * blend_rgb)
    )
    final_rgb /= np.maximum(np.dstack((final_a,) * 3), 0.0001)  # type: ignore
    final_rgb = np.clip(final_rgb, 0, 1)

    result = np.concatenate([final_rgb, np.expand_dims(final_a, axis=2)], axis=2)
    if needs_clipping:
        result = np.clip(result, 0, 1)
    return result


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


def preview_encode(
    img: np.ndarray,
    target_size: int = 512,
    grace: float = 1.2,
    lossless: bool = False,
) -> Tuple[str, np.ndarray]:
    """
    resize the image, so the preview loads faster and doesn't lag the UI
    512 was chosen as the default target because a 512x512 RGBA 8bit PNG is at most 1MB in size
    """
    h, w, c = get_h_w_c(img)

    max_size = target_size * grace
    if w > max_size or h > max_size:
        f = max(w / target_size, h / target_size)
        img = cv2.resize(img, (int(w / f), int(h / f)), interpolation=cv2.INTER_AREA)

    image_format = "png" if c > 3 or lossless else "jpg"

    _, encoded_img = cv2.imencode(f".{image_format}", (img * 255).astype("uint8"))  # type: ignore
    base64_img = base64.b64encode(encoded_img).decode("utf8")

    return f"data:image/{image_format};base64,{base64_img}", img
