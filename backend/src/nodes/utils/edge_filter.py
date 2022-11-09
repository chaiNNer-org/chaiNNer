from typing import Literal, Dict, Tuple
import numpy as np

EdgeFilter = Literal[
    "sobel",
    "sobel-like-5",
    "sobel-like-7",
    "sobel-like-9",
    "prewitt",
    "scharr",
    "4-sample",
]


class EdgeFilters:
    Sobel: EdgeFilter = "sobel"
    SobelLike5: EdgeFilter = "sobel-like-5"
    SobelLike7: EdgeFilter = "sobel-like-7"
    SobelLike9: EdgeFilter = "sobel-like-9"
    Prewitt: EdgeFilter = "prewitt"
    Scharr: EdgeFilter = "scharr"
    FourSample: EdgeFilter = "4-sample"


FILTERS_X: Dict[EdgeFilter, np.ndarray] = {
    "sobel": np.array(
        [
            [+1, 0, -1],
            [+2, 0, -2],
            [+1, 0, -1],
        ]
    ),
    "sobel-like-5": np.array(
        [
            [1 / 16, 1 / 10, 0, -1 / 10, -1 / 16],
            [1 / 10, 1 / 2.8, 0, -1 / 2.8, -1 / 10],
            [1 / 8, 1 / 2.0, 0, -1 / 2.0, -1 / 8],
            [1 / 10, 1 / 2.8, 0, -1 / 2.8, -1 / 10],
            [1 / 16, 1 / 10, 0, -1 / 10, -1 / 16],
        ]
    ),
    "sobel-like-7": np.array(
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
    "sobel-like-9": np.array(
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
    "prewitt": np.array(
        [
            [+1, 0, -1],
            [+1, 0, -1],
            [+1, 0, -1],
        ]
    ),
    "scharr": np.array(
        [
            [+3, 0, -3],
            [+10, 0, -10],
            [+3, 0, -3],
        ]
    ),
    "4-sample": np.array(
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
    left = filter_x[:, :w // 2]
    filter_x = filter_x / np.sum(left)

    filter_y = np.rot90(filter_x, -1)
    return filter_x, filter_y
