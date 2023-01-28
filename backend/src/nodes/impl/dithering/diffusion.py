import numpy as np

from .color_distance import (
    ColorDistanceFunction,
    nearest_palette_color,
    nearest_uniform_color,
)
from .common import dtype_to_float, float_to_dtype
from .constants import ErrorDiffusionMap, ERROR_DIFFUSION_MAPS
from ..image_utils import as_3d


def error_diffusion_dither(
    image: np.ndarray, error_diffusion_map: ErrorDiffusionMap, nearest_color_func
) -> np.ndarray:
    image = as_3d(image)

    output_image = dtype_to_float(image)
    edm = ERROR_DIFFUSION_MAPS[error_diffusion_map]
    for j in range(output_image.shape[1]):
        for i in range(output_image.shape[0]):
            pixel = np.array(output_image[i, j, :])
            output_image[i, j, :] = nearest_color_func(pixel)
            error = pixel - output_image[i, j, :]
            for (di, dj), coefficient in edm.items():
                if i + di >= output_image.shape[0] or j + dj >= output_image.shape[1]:
                    continue
                output_image[i + di, j + dj, :] += error * coefficient
    return float_to_dtype(output_image, image.dtype)


def uniform_error_diffusion_dither(
    image: np.ndarray, error_diffusion_map: ErrorDiffusionMap, num_colors: int
) -> np.ndarray:
    def nearest_color_func(pixel: np.ndarray) -> np.ndarray:
        return nearest_uniform_color(pixel, num_colors)

    return error_diffusion_dither(image, error_diffusion_map, nearest_color_func)


def palette_error_diffusion_dither(
    image: np.ndarray,
    palette: np.ndarray,
    color_distance_function: ColorDistanceFunction,
    error_diffusion_map: ErrorDiffusionMap,
) -> np.ndarray:
    palette = as_3d(palette)

    def nearest_color_func(pixel: np.ndarray) -> np.ndarray:
        return nearest_palette_color(pixel, palette, color_distance_function)

    return error_diffusion_dither(image, error_diffusion_map, nearest_color_func)
