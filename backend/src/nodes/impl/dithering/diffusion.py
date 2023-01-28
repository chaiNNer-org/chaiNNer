import numpy as np

from .color_distance import (
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
    for col in range(output_image.shape[1]):
        for row in range(output_image.shape[0]):
            pixel = np.array(output_image[row, col, :])
            output_image[row, col, :] = nearest_color_func(pixel)
            error = pixel - output_image[row, col, :]
            for (delta_col, delta_row), coefficient in edm.items():
                if row + delta_row >= output_image.shape[0] or col + delta_col >= output_image.shape[1]:
                    continue
                output_image[row + delta_row, col + delta_col, :] += error * coefficient
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
    error_diffusion_map: ErrorDiffusionMap,
) -> np.ndarray:
    palette = as_3d(palette)

    def nearest_color_func(pixel: np.ndarray) -> np.ndarray:
        return nearest_palette_color(pixel, palette)

    return error_diffusion_dither(image, error_diffusion_map, nearest_color_func)
