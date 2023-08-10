import numpy as np

from ..image_utils import as_3d
from .color_distance import (
    NearestColorFn,
    create_nearest_palette_color_lookup,
    nearest_uniform_color,
)
from .common import as_dtype, as_float32
from .constants import ERROR_DIFFUSION_MAPS, ErrorDiffusionMap


def error_diffusion_dither(
    image: np.ndarray,
    error_diffusion_map: ErrorDiffusionMap,
    nearest_color_func: NearestColorFn,
) -> np.ndarray:
    image = as_3d(image)

    output_image = as_float32(image).copy()
    h = output_image.shape[0]
    w = output_image.shape[1]
    edm = ERROR_DIFFUSION_MAPS[error_diffusion_map]
    for row in range(h):
        for col in range(w):
            pixel = np.array(output_image[row, col, :])
            nearest = nearest_color_func(pixel)
            output_image[row, col, :] = nearest
            error = pixel - nearest
            for (delta_row, delta_col), coefficient in edm.items():
                y = row + delta_row
                x = col + delta_col
                if 0 < x < w and 0 < y < h:
                    output_image[y, x, :] += error * coefficient
    return as_dtype(output_image, image.dtype)


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
    palette = as_float32(as_3d(palette))
    nearest_color_func = create_nearest_palette_color_lookup(palette)
    return error_diffusion_dither(image, error_diffusion_map, nearest_color_func)
