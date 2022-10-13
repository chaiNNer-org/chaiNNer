from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Callable, Optional, Union
import math

import numpy as np
from sanic.log import logger

from .utils import get_h_w_c


class Split:
    pass


class Tiler(ABC):
    @abstractmethod
    def starting_tile_size(self, width: int, height: int, channels: int) -> int:
        raise NotImplemented

    def split(self, tile_size: int) -> int:
        assert tile_size >= 16
        return max(16, tile_size // 2)


class NoTiling(Tiler):
    def starting_tile_size(self, width: int, height: int, _channels: int) -> int:
        return max(width, height)

    def split(self, _tile_size: int) -> int:
        raise ValueError(f"Image cannot be upscale with No Tiling mode.")


class MaxTileSize(Tiler):
    def __init__(self, tile_size: int) -> None:
        self.tile_size: int = tile_size

    def starting_tile_size(self, width: int, height: int, _channels: int) -> int:
        # Tile size a lot larger than the image don't make sense.
        # So we use the minimum of the image dimensions and the given tile size.
        max_tile_size = max(width + 10, height + 10)
        return min(self.tile_size, max_tile_size)


def auto_split(
    img: np.ndarray,
    upscale: Callable[[np.ndarray], Union[np.ndarray, Split]],
    tiler: Tiler,
    overlap: int = 16,
) -> np.ndarray:
    """
    Splits the image into tiles with at most the given tile size.

    If the upscale method requests a split, then the tile size will be lowered.
    """

    h, w, c = get_h_w_c(img)
    max_tile_size = tiler.starting_tile_size(w, h, c)
    logger.info(
        f"Auto split image ({w}x{h}px @ {c}) with initial tile size {max_tile_size}."
    )

    if h <= max_tile_size and w <= max_tile_size:
        # the image might be small enough so that we don't have to split at all
        upscale_result = upscale(img)
        if not isinstance(upscale_result, Split):
            return upscale_result

        # the image was too large
        max_tile_size = tiler.split(max_tile_size)

        logger.info(
            f"Unable to upscale the whole image at once. Reduced tile size to {max_tile_size}."
        )

    # The upscale method is allowed to request splits at any time.
    # When a split occurs, we have to "restart" the loop and
    # these 2 variables allow us to split the already processed tiles.
    start_x = 0
    start_y = 0

    # To allocate the result image, we need to know the upscale factor first,
    # and we only get to know this factor after the first successful upscale.
    result: Optional[np.ndarray] = None
    scale: int = 0

    restart = True
    while restart:
        restart = False

        # This is a bit complex.
        # We don't actually use the current tile size to partition the image.
        # If we did, then tile_size=1024 and w=1200 would result in very uneven tiles.
        # Instead, we use tile_size to calculate how many tiles we get in the x and y direction
        # and then calculate the optimal tile size for the x and y direction using the counts.
        # This yields optimal tile sizes which should prevent unnecessary splitting.
        tile_count_x = math.ceil(w / max_tile_size)
        tile_count_y = math.ceil(h / max_tile_size)
        tile_size_x = math.ceil(w / tile_count_x)
        tile_size_y = math.ceil(h / tile_count_y)

        logger.info(
            f"Currently {tile_count_x}x{tile_count_y} tiles each {tile_size_x}x{tile_size_y}px."
        )

        for y in range(0, tile_count_y):
            if restart:
                break
            if y < start_y:
                continue

            for x in range(0, tile_count_x):
                if y == start_y and x < start_x:
                    continue

                x_min = max(0, x * tile_size_x - overlap)
                y_min = max(0, y * tile_size_y - overlap)
                x_max = min(w, (x + 1) * tile_size_x + overlap)
                y_max = min(h, (y + 1) * tile_size_y + overlap)

                upscale_result = upscale(img[y_min:y_max, x_min:x_max, ...])

                if isinstance(upscale_result, Split):
                    max_tile_size = tiler.split(max_tile_size)

                    new_tile_count_x = math.ceil(w / max_tile_size)
                    new_tile_count_y = math.ceil(h / max_tile_size)
                    new_tile_size_x = math.ceil(w / new_tile_count_x)
                    new_tile_size_y = math.ceil(h / new_tile_count_y)
                    start_x = (x * tile_size_x) // new_tile_size_x
                    start_y = (y * tile_size_x) // new_tile_size_y

                    logger.info(
                        f"Split occurred. New tile size is {max_tile_size}. Starting at {start_x},{start_y}."
                    )

                    restart = True
                    break

                # figure out by how much the image was upscaled by
                up_h, up_w, _ = get_h_w_c(upscale_result)
                current_scale = up_h // (y_max - y_min)
                assert current_scale > 0
                assert (y_max - y_min) * current_scale == up_h
                assert (x_max - x_min) * current_scale == up_w

                if result is None:
                    # allocate the result image
                    scale = current_scale
                    result = np.zeros((h * scale, w * scale, c), dtype=np.float32)

                assert current_scale == scale

                # remove overlap padding
                pad_left = abs(x * tile_size_x - x_min)
                pad_top = abs(y * tile_size_y - y_min)
                pad_right = abs(min(w, (x + 1) * tile_size_x) - x_max)
                pad_bottom = abs(min(h, (y + 1) * tile_size_y) - y_max)

                up_x = pad_left * scale
                up_y = pad_top * scale
                up_w = up_w - (pad_left + pad_right) * scale
                up_h = up_h - (pad_top + pad_bottom) * scale

                upscale_result = upscale_result[
                    up_y : (up_y + up_h),
                    up_x : (up_x + up_w),
                    ...,
                ]

                # copy into result image
                res_x = x * tile_size_x * scale
                res_y = y * tile_size_y * scale
                result[
                    res_y : (res_y + up_h),
                    res_x : (res_x + up_w),
                    ...,
                ] = upscale_result

    assert result is not None
    return result


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

    GB_AMT = 1024**3
    required_mem = f"{mem_required_estimation/GB_AMT:.2f}"
    budget_mem = f"{budget/GB_AMT:.2f}"
    logger.info(
        f"Estimating memory required: {required_mem} GB, {budget_mem} GB free."
        f" Estimated tile size: {tile_size}"
    )

    return tile_size
