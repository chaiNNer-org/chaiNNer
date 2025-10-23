from typing import Callable, NewType

import numpy as np

from logger import logger

from ...utils.utils import get_h_w_c
from .tiler import MaxTileSize, NoTiling, Tiler

GB_AMT = 1024**3


def estimate_tile_size(
    budget: int,
    model_size: int,
    img: np.ndarray,
    img_element_size: int = 4,
) -> int:
    h, w, c = get_h_w_c(img)
    img_bytes = h * w * c * img_element_size
    mem_required_estimation = (model_size / (1024 * 52)) * img_bytes

    tile_pixels = w * h * budget / mem_required_estimation
    # the largest power-of-2 tile_size such that tile_size**2 < tile_pixels
    tile_size = 2 ** (int(tile_pixels**0.5).bit_length() - 1)

    required_mem = f"{mem_required_estimation / GB_AMT:.2f}"
    budget_mem = f"{budget / GB_AMT:.2f}"
    logger.debug(
        "Estimating memory required: %s GB, %s GB free. Estimated tile size: %s",
        required_mem,
        budget_mem,
        tile_size,
    )

    return tile_size


TileSize = NewType("TileSize", int)
ESTIMATE = TileSize(0)
NO_TILING = TileSize(-1)
MAX_TILE_SIZE = TileSize(-2)
CUSTOM = TileSize(-3)
TILE_SIZE_256 = TileSize(256)


def parse_tile_size_input(tile_size: TileSize, estimate: Callable[[], Tiler]) -> Tiler:
    if tile_size == 0:
        return estimate()
    if tile_size == -1:
        return NoTiling()
    if tile_size == -2:
        return MaxTileSize()

    assert tile_size > 0
    return MaxTileSize(tile_size)
