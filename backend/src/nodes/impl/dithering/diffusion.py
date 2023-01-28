import numpy as np

from .color_distance import ColorDistanceFunction, nearest_palette_color
from .common import dtype_to_float, float_to_dtype, apply_to_all_channels
from .constants import ErrorDiffusionMap, ERROR_DIFFUSION_MAPS
from .quantize import one_channel_nearest_uniform_color
from ..image_utils import as_3d


def one_channel_uniform_error_diffusion(
        image: np.ndarray, num_colors: int, error_diffusion_map: ErrorDiffusionMap
) -> np.ndarray:
    output_image = dtype_to_float(image)
    edm = ERROR_DIFFUSION_MAPS[error_diffusion_map]
    for j in range(output_image.shape[1]):
        for i in range(output_image.shape[0]):
            pixel = output_image[i, j]
            output_image[i, j] = one_channel_nearest_uniform_color(pixel, num_colors)
            error = pixel - output_image[i, j]
            for (di, dj), coefficient in edm.items():
                if i + di >= output_image.shape[0] or j + dj >= output_image.shape[1]:
                    continue
                output_image[i + di, j + dj] += error * coefficient
    return float_to_dtype(output_image, image.dtype)


def uniform_error_diffusion_dither(
        image: np.ndarray, error_diffusion_map: ErrorDiffusionMap, num_colors: int
) -> np.ndarray:
    return apply_to_all_channels(
        one_channel_uniform_error_diffusion,
        image,
        num_colors=num_colors,
        error_diffusion_map=error_diffusion_map,
    )


def nearest_color_error_diffusion_dither(
        image: np.ndarray,
        palette: np.ndarray,
        color_distance_function: ColorDistanceFunction,
        error_diffusion_map: ErrorDiffusionMap,
) -> np.ndarray:
    if image.ndim == 2:
        image = as_3d(image)
    if palette.ndim == 2:
        palette = as_3d(palette)

    output_image = dtype_to_float(image)
    edm = ERROR_DIFFUSION_MAPS[error_diffusion_map]
    for j in range(output_image.shape[1]):
        for i in range(output_image.shape[0]):
            pixel = np.array(output_image[i, j, :])
            _, output_image[i, j, :] = nearest_palette_color(
                pixel, palette, color_distance_function
            )
            error = pixel - output_image[i, j, :]
            for (di, dj), coefficient in edm.items():
                if i + di >= output_image.shape[0] or j + dj >= output_image.shape[1]:
                    continue
                output_image[i + di, j + dj, :] += error * coefficient
    return float_to_dtype(output_image, image.dtype)
