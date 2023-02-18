from enum import Enum
from typing import Dict, Tuple

import numpy as np


class EdgeFilter(Enum):
    SOBEL = "sobel"
    SOBEL_LIKE_5 = "sobel-like-5"
    SOBEL_LIKE_7 = "sobel-like-7"
    SOBEL_LIKE_9 = "sobel-like-9"
    PREWITT = "prewitt"
    SCHARR = "scharr"
    FOUR_SAMPLE = "4-sample"


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


def get_filter_kernels(edge_filter: EdgeFilter) -> Tuple[np.ndarray, np.ndarray]:
    """
    Returns the x and y kernels of the given edge filter.
    """

    filter_x = FILTERS_X.get(edge_filter, None)
    assert filter_x is not None, f"Unknown filter '{edge_filter}'"

    # normalize filter
    _h, w = filter_x.shape
    left = filter_x[:, : w // 2]
    filter_x = filter_x / np.sum(left)

    filter_y = np.rot90(filter_x, -1)
    return filter_x, filter_y
