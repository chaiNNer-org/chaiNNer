from enum import Enum
from typing import Dict, Tuple

import numpy as np
from sanic.log import logger

# https://tannerhelland.com/2012/12/28/dithering-eleven-algorithms-source-code.html


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

"""
These diffusion maps indicate where the residual error from each pixel is "pushed" and how much.

The key is a relative coordinate (row, column) (relative to the pixel currently being processed) and the value is the 
proportion of the error that will get added to this pixel. 
"""

ERROR_DIFFUSION_MAP_TYPE = Dict[Tuple[int, int], float]
ERROR_DIFFUSION_MAPS: Dict[ErrorDiffusionMap, ERROR_DIFFUSION_MAP_TYPE] = {
    ErrorDiffusionMap.ATKINSON: {
        (0, 1): 1 / 8,
        (0, 2): 1 / 8,
        (1, -1): 1 / 8,
        (1, 0): 1 / 8,
        (1, 1): 1 / 8,
        (2, 0): 1 / 8,
    },
    ErrorDiffusionMap.BURKES: {
        (0, 1): 8 / 32,
        (0, 2): 4 / 32,
        (1, -2): 2 / 32,
        (1, -1): 4 / 32,
        (1, 0): 8 / 32,
        (1, 1): 4 / 32,
        (1, 2): 2 / 32,
    },
    ErrorDiffusionMap.FLOYD_STEINBERG: {
        (0, 1): 7 / 16,
        (1, -1): 3 / 16,
        (1, 0): 5 / 16,
        (1, 1): 1 / 16,
    },
    ErrorDiffusionMap.JARVIS_ET_AL: {
        (0, 1): 7 / 48,
        (0, 2): 5 / 48,
        (1, -2): 3 / 48,
        (1, -1): 5 / 48,
        (1, 0): 7 / 48,
        (1, 1): 5 / 48,
        (1, 2): 3 / 48,
        (2, -2): 1 / 48,
        (2, -1): 3 / 48,
        (2, 0): 5 / 48,
        (2, 1): 3 / 48,
        (2, 2): 1 / 48,
    },
    ErrorDiffusionMap.SIERRA: {
        (0, 1): 5 / 32,
        (0, 2): 3 / 32,
        (1, -2): 2 / 32,
        (1, -1): 4 / 32,
        (1, 0): 5 / 32,
        (1, 1): 4 / 32,
        (1, 2): 2 / 32,
        (2, -1): 2 / 32,
        (2, 0): 3 / 32,
        (2, 1): 2 / 32,
    },
    ErrorDiffusionMap.TWO_ROW_SIERRA: {
        (0, 1): 4 / 16,
        (0, 2): 3 / 16,
        (1, -2): 1 / 16,
        (1, -1): 2 / 16,
        (1, 0): 3 / 16,
        (1, 1): 2 / 16,
        (1, 2): 1 / 16,
    },
    ErrorDiffusionMap.SIERRA_LITE: {(0, 1): 2 / 4, (1, -1): 1 / 4, (1, 0): 1 / 4},
    ErrorDiffusionMap.STUCKI: {
        (0, 1): 8 / 42,
        (0, 2): 4 / 42,
        (1, -2): 2 / 42,
        (1, -1): 4 / 42,
        (1, 0): 8 / 42,
        (1, 1): 4 / 42,
        (1, 2): 2 / 42,
        (2, -2): 1 / 42,
        (2, -1): 2 / 42,
        (2, 0): 4 / 42,
        (2, 1): 2 / 42,
        (2, 2): 1 / 42,
    },
}

# Sanity check
for error_diffusion_map, coords in ERROR_DIFFUSION_MAPS.items():
    for (row, column), _ in coords.items():
        if row < 0 or (row == 0 and column <= 0):
            logger.warning(
                f"Error diffusion map {error_diffusion_map} has an illegal coordinate: {row}, {column}"
            )


# https://en.wikipedia.org/wiki/Ordered_dithering


class ThresholdMap(Enum):
    BAYER_2 = "B2"
    BAYER_4 = "B4"
    BAYER_8 = "B8"
    BAYER_16 = "B16"


THRESHOLD_MAP_LABELS = {
    ThresholdMap.BAYER_2: "Bayer 2x2",
    ThresholdMap.BAYER_4: "Bayer 4x4",
    ThresholdMap.BAYER_8: "Bayer 8x8",
    ThresholdMap.BAYER_16: "Bayer 16x16",
}
# fmt: off
THRESHOLD_MAPS = {
    ThresholdMap.BAYER_2: np.array([
        [0, 2],
        [3, 1]]),
    ThresholdMap.BAYER_4: np.array([
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]]),
    ThresholdMap.BAYER_8: np.array([
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21]]),
    ThresholdMap.BAYER_16: np.array([
        [0, 191, 48, 239, 12, 203, 60, 251, 3, 194, 51, 242, 15, 206, 63, 254],
        [127, 64, 175, 112, 139, 76, 187, 124, 130, 67, 178, 115, 142, 79, 190, 127],
        [32, 223, 16, 207, 44, 235, 28, 219, 35, 226, 19, 210, 47, 238, 31, 222],
        [159, 96, 143, 80, 171, 108, 155, 92, 162, 99, 146, 83, 174, 111, 158, 95],
        [8, 199, 56, 247, 4, 195, 52, 243, 11, 202, 59, 250, 7, 198, 55, 246],
        [135, 72, 183, 120, 131, 68, 179, 116, 138, 75, 186, 123, 134, 71, 182, 119],
        [40, 231, 24, 215, 36, 227, 20, 211, 43, 234, 27, 218, 39, 230, 23, 214],
        [167, 104, 151, 88, 163, 100, 147, 84, 170, 107, 154, 91, 166, 103, 150, 87],
        [2, 193, 50, 241, 14, 205, 62, 253, 1, 192, 49, 240, 13, 204, 61, 252],
        [129, 66, 177, 114, 141, 78, 189, 126, 128, 65, 176, 113, 140, 77, 188, 125],
        [34, 225, 18, 209, 46, 237, 30, 221, 33, 224, 17, 208, 45, 236, 29, 220],
        [161, 98, 145, 82, 173, 110, 157, 94, 160, 97, 144, 81, 172, 109, 156, 93],
        [10, 201, 58, 249, 6, 197, 54, 245, 9, 200, 57, 248, 5, 196, 53, 244],
        [137, 74, 185, 122, 133, 70, 181, 118, 136, 73, 184, 121, 132, 69, 180, 117],
        [42, 233, 26, 217, 38, 229, 22, 213, 41, 232, 25, 216, 37, 228, 21, 212],
        [169, 106, 153, 90, 165, 102, 149, 86, 168, 105, 152, 89, 164, 101, 148, 85]]),
}
# fmt: on
