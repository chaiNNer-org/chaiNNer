import numpy as np
from enum import Enum
from sanic.log import logger
from typing import Tuple, Dict

from .common import dtype_to_float, float_to_dtype, uniform_quantize_image, find_closest_uniform_color, apply_to_all_channels
from ..image_utils import MAX_VALUES_BY_DTYPE
from ...utils.utils import get_h_w_c


class ErrorDiffusionMap(Enum):
    FLOYD_STEINBERG = "FS"
    JARVIS_ET_AL = "JJN"
    STUCKI = "ST"
    ATKINSON = "A"
    BURKES = "B"
    SIERRA = "S"
    TWO_ROW_SIERRA = "S2"
    SIERRA_LITE = "SL"


ERROR_PROPAGATION_MAP_LABELS = {
    ErrorDiffusionMap.FLOYD_STEINBERG: "Floyd-Steinberg",
    ErrorDiffusionMap.JARVIS_ET_AL: "Jarvis, Judice, and Ninke",
    ErrorDiffusionMap.STUCKI: "Stucki",
    ErrorDiffusionMap.ATKINSON: "Atkinson",
    ErrorDiffusionMap.BURKES: "Burkes",
    ErrorDiffusionMap.SIERRA: "Sierra",
    ErrorDiffusionMap.TWO_ROW_SIERRA: "Two Row Sierra",
    ErrorDiffusionMap.SIERRA_LITE: "Sierra Lite",
}

ERROR_DIFFUSION_MAP_TYPE = Dict[Tuple[int, int], float]
ERROR_DIFFUSION_MAPS: Dict[ErrorDiffusionMap, ERROR_DIFFUSION_MAP_TYPE] = {
    # https://tannerhelland.com/2012/12/28/dithering-eleven-algorithms-source-code.html
    ErrorDiffusionMap.FLOYD_STEINBERG: {
        (1, 0): 7 / 16,
        (-1, 1): 3 / 16,
        (0, 1): 5 / 16,
        (1, 1): 1 / 16,
    },
    ErrorDiffusionMap.JARVIS_ET_AL: {
        (1, 0): 7 / 48,
        (2, 0): 5 / 48,
        (-2, 1): 3 / 48,
        (-1, 1): 5 / 48,
        (0, 1): 7 / 48,
        (1, 1): 5 / 48,
        (2, 1): 3 / 48,
        (-2, 2): 1 / 48,
        (-1, 2): 3 / 48,
        (0, 2): 5 / 48,
        (1, 2): 3 / 48,
        (2, 2): 1 / 48,
    },
    ErrorDiffusionMap.STUCKI: {
        (1, 0): 8 / 42,
        (2, 0): 4 / 42,
        (-2, 1): 2 / 42,
        (-1, 1): 4 / 42,
        (0, 1): 8 / 42,
        (1, 1): 4 / 42,
        (2, 1): 2 / 42,
        (-2, 2): 1 / 42,
        (-1, 2): 2 / 42,
        (0, 2): 4 / 42,
        (1, 2): 2 / 42,
        (2, 2): 1 / 42,
    },
    ErrorDiffusionMap.ATKINSON: {
        (1, 0): 1 / 8,
        (2, 0): 1 / 8,
        (-1, 1): 1 / 8,
        (0, 1): 1 / 8,
        (1, 1): 1 / 8,
        (0, 2): 1 / 8,
    },
    ErrorDiffusionMap.BURKES: {
        (1, 0): 8 / 32,
        (2, 0): 4 / 32,
        (-2, 1): 2 / 32,
        (-1, 1): 4 / 32,
        (0, 1): 8 / 32,
        (1, 1): 4 / 32,
        (2, 1): 2 / 32,
    },
    ErrorDiffusionMap.SIERRA: {
        (1, 0): 5 / 32,
        (2, 0): 3 / 32,
        (-2, 1): 2 / 32,
        (-1, 1): 4 / 32,
        (0, 1): 5 / 32,
        (1, 1): 4 / 32,
        (2, 1): 2 / 32,
        (-1, 2): 2 / 32,
        (0, 2): 3 / 32,
        (1, 2): 2 / 32,
    },
    ErrorDiffusionMap.TWO_ROW_SIERRA: {
        (1, 0): 4 / 16,
        (2, 0): 3 / 16,
        (-2, 1): 1 / 16,
        (-1, 1): 2 / 16,
        (0, 1): 3 / 16,
        (1, 1): 2 / 16,
        (2, 1): 1 / 16,
    },
    ErrorDiffusionMap.SIERRA_LITE: {
        (1, 0): 2 / 4,
        (-1, 1): 1 / 4,
        (0, 1): 1 / 4,
    },
}


def one_channel_error_diffusion(image: np.ndarray, num_colors: int,
                                error_diffusion_map: ERROR_DIFFUSION_MAP_TYPE) -> np.ndarray:
    output_image = dtype_to_float(image)
    edm = ERROR_DIFFUSION_MAPS[error_diffusion_map]
    for j in range(output_image.shape[1]):
        for i in range(output_image.shape[0]):
            pixel = output_image[i, j]
            output_image[i, j] = find_closest_uniform_color(pixel, num_colors)
            error = pixel - output_image[i, j]
            for (di, dj), coefficient in edm.items():
                if i + di >= output_image.shape[0] or j + dj >= output_image.shape[1]: continue
                output_image[i + di, j + dj] += error * coefficient
    return float_to_dtype(output_image, image.dtype)


def error_diffusion_dither(image: np.ndarray, error_diffusion_map: ErrorDiffusionMap, num_colors: int) -> np.ndarray:
    return apply_to_all_channels(one_channel_error_diffusion,
                                 image, num_colors=num_colors, error_diffusion_map=error_diffusion_map)
