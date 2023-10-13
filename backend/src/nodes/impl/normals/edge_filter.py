import math
from enum import Enum
from typing import Dict, List, Tuple

import numpy as np

a = [
    [1 / 16, 1 / 10, 0, -1 / 10, -1 / 16],
    [1 / 10, 1 / 2.8, 0, -1 / 2.8, -1 / 10],
    [1 / 8, 1 / 2.0, 0, -1 / 2.0, -1 / 8],
    [1 / 10, 1 / 2.8, 0, -1 / 2.8, -1 / 10],
    [1 / 16, 1 / 10, 0, -1 / 10, -1 / 16],
]
a = [
    [1, 1.6, 0, -1.6, -1 / 16],
    [1.6, 16 / 2.8, 0, -1 / 2.8, -1 / 10],
    [2, 8, 0, -1 / 2.0, -1 / 8],
    [1.6, 16 / 2.8, 0, -1 / 2.8, -1 / 10],
    [1, 1.6, 0, -1.6, -1 / 16],
]


class EdgeFilter(Enum):
    SOBEL = "sobel"
    SOBEL_LIKE_5 = "sobel-like-5"
    SOBEL_LIKE_7 = "sobel-like-7"
    SOBEL_LIKE_9 = "sobel-like-9"
    PREWITT = "prewitt"
    SCHARR = "scharr"
    FOUR_SAMPLE = "4-sample"

    MULTI_GAUSS = "multi-gauss"


FILTERS_X: Dict[EdgeFilter, np.ndarray] = {
    EdgeFilter.SOBEL: np.array(
        [
            [+1, 0, -1],
            [+2, 0, -2],
            [+1, 0, -1],
        ]
    ),
    EdgeFilter.SOBEL_LIKE_5: np.array(
        [
            [1 / 16, 1 / 10, 0, -1 / 10, -1 / 16],
            [1 / 10, 1 / 2.8, 0, -1 / 2.8, -1 / 10],
            [1 / 8, 1 / 2.0, 0, -1 / 2.0, -1 / 8],
            [1 / 10, 1 / 2.8, 0, -1 / 2.8, -1 / 10],
            [1 / 16, 1 / 10, 0, -1 / 10, -1 / 16],
        ]
    ),
    EdgeFilter.SOBEL_LIKE_7: np.array(
        [
            [1, 2, 3, 0, -3, -2, -1],
            [2, 3, 4, 0, -4, -3, -2],
            [3, 4, 5, 0, -5, -4, -3],
            [4, 5, 6, 0, -6, -5, -4],
            [3, 4, 5, 0, -5, -4, -3],
            [2, 3, 4, 0, -4, -3, -2],
            [1, 2, 3, 0, -3, -2, -1],
        ]
    ),
    EdgeFilter.SOBEL_LIKE_9: np.array(
        [
            [1, 2, 3, 4, 0, -4, -3, -2, -1],
            [2, 3, 4, 5, 0, -5, -4, -3, -2],
            [3, 4, 5, 6, 0, -6, -5, -4, -3],
            [4, 5, 6, 7, 0, -7, -6, -5, -4],
            [5, 6, 7, 8, 0, -8, -7, -6, -5],
            [4, 5, 6, 7, 0, -7, -6, -5, -4],
            [3, 4, 5, 6, 0, -6, -5, -4, -3],
            [2, 3, 4, 5, 0, -5, -4, -3, -2],
            [1, 2, 3, 4, 0, -4, -3, -2, -1],
        ]
    ),
    EdgeFilter.PREWITT: np.array(
        [
            [+1, 0, -1],
            [+1, 0, -1],
            [+1, 0, -1],
        ]
    ),
    EdgeFilter.SCHARR: np.array(
        [
            [+3, 0, -3],
            [+10, 0, -10],
            [+3, 0, -3],
        ]
    ),
    EdgeFilter.FOUR_SAMPLE: np.array(
        [
            [1, 0, -1],
        ]
    ),
}


def create_gauss_kernel(parameters: List[Tuple[float, float]]) -> np.ndarray:
    """
    Parameters is a list of tuples (sigma, weight).
    """

    # We will use 2D gauss functions normalized to a volume of 1. Wikipedia
    # has a nice article about this, so look it up if you want to know more:
    # https://en.wikipedia.org/wiki/Gaussian_function#Two-dimensional_Gaussian_function
    #
    # We will one scaled gauss function for each parameter scaled by its weight.
    # All gauss function will then be added together. This means that the total
    # volume will be the sum of all weights.

    total_volume = sum(weight for _, weight in parameters)
    if total_volume == 0:
        # this case doesn't really make sense, so GIGO
        return np.zeros((1, 1))

    def sample(x: float, y: float) -> float:
        s = 0
        for o, weight in parameters:
            std2 = 2 * o * o
            s += weight / (math.pi * std2) * np.exp(-(x * x + y * y) / std2)
        return s

    # First, we need to figure out the kernel size. We'll simply use the
    # 2 sigma rule.
    kernel_radius = 1
    for o, weight in parameters:
        if weight > 0:
            kernel_radius = max(kernel_radius, math.ceil(2 * o))
    kernel_radius += 1

    # Now we can create the kernel.
    kernel_size = 2 * kernel_radius + 1
    kernel = np.zeros((kernel_size, kernel_size))
    x_offsets = [0, 0.25, 0.5, 0.75]
    for y in range(kernel_size):
        y = y - kernel_radius
        for x in range(kernel_size):
            x = x - kernel_radius
            # we shift the x value with `abs(x) - 1` to make sure that we sample
            # the top of the bell curve. This will give sharper results.
            s = 0
            for x_offset in x_offsets:
                s += sample(abs(x) - 1 + x_offset, y)
            kernel[kernel_radius + y, kernel_radius + x] = (
                s / len(x_offsets) * -np.sign(x)
            )

    return kernel


def get_filter_kernels(
    edge_filter: EdgeFilter,
    gauss_parameter: List[Tuple[float, float]],
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Returns the x and y kernels of the given edge filter.
    """

    filter_x = FILTERS_X.get(edge_filter, None)
    if edge_filter == EdgeFilter.MULTI_GAUSS:
        filter_x = create_gauss_kernel(gauss_parameter)
    assert filter_x is not None, f"Unknown filter '{edge_filter}'"

    if edge_filter != EdgeFilter.MULTI_GAUSS:
        # normalize filter
        _h, w = filter_x.shape
        left = filter_x[:, : w // 2]
        filter_x = filter_x / np.sum(left)

    filter_y = np.rot90(filter_x, -1)
    return filter_x, filter_y
