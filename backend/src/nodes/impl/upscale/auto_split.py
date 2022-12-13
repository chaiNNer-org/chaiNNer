from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Callable, Optional, Union, Tuple
import math

import numpy as np
from sanic.log import logger

from ...utils.utils import get_h_w_c, Region
from .exact_split import exact_split


class Split:
    pass


class Tiler(ABC):
    def exact_tile_size(self) -> Tuple[int, int] | None:
        return None

    @abstractmethod
    def starting_tile_size(self, width: int, height: int, channels: int) -> int:
        pass

    def split(self, tile_size: int) -> int:
        assert tile_size >= 16
        return max(16, tile_size // 2)


class NoTiling(Tiler):
    def starting_tile_size(self, width: int, height: int, _channels: int) -> int:
        return max(width, height)

    def split(self, _tile_size: int) -> int:
        raise ValueError(f"Image cannot be upscale with No Tiling mode.")


class MaxTileSize(Tiler):
    def __init__(self, tile_size: int = 2**31) -> None:
        self.tile_size: int = tile_size

    def starting_tile_size(self, width: int, height: int, _channels: int) -> int:
        # Tile size a lot larger than the image don't make sense.
        # So we use the minimum of the image dimensions and the given tile size.
        max_tile_size = max(width + 10, height + 10)
        return min(self.tile_size, max_tile_size)


class ExactTileSize(Tiler):
    def __init__(self, exact_size: Tuple[int, int]) -> None:
        self.exact_size = exact_size

    def exact_tile_size(self) -> Tuple[int, int] | None:
        return self.exact_size

    def starting_tile_size(self, width: int, height: int, _channels: int) -> int:
        return max(*self.exact_size)


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

    exact_tile_size = tiler.exact_tile_size()
    if exact_tile_size is not None:
        logger.info(
            f"Exact size split image ({w}x{h}px @ {c}) with exact tile size {exact_tile_size[0]}x{exact_tile_size[1]}px."
        )

        def no_split_upscale(i: np.ndarray) -> np.ndarray:
            result = upscale(i)
            if isinstance(result, Split):
                raise ValueError(
                    f"Splits are not supported for exact size ({exact_tile_size[0]}x{exact_tile_size[1]}px) splitting."
                    f" This typically means that your machine does not have enough VRAM to run the current model."
                )
            return result

        return exact_split(
            img=img,
            exact_size=exact_tile_size,
            upscale=no_split_upscale,
            overlap=overlap,
        )

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

    img_region = Region(0, 0, w, h)

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

                tile = Region(
                    x * tile_size_x, y * tile_size_y, tile_size_x, tile_size_y
                ).intersect(img_region)
                pad = img_region.child_padding(tile).min(overlap)
                padded_tile = tile.add_padding(pad)

                upscale_result = upscale(padded_tile.read_from(img))

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
                current_scale = up_h // padded_tile.height
                assert current_scale > 0
                assert padded_tile.height * current_scale == up_h
                assert padded_tile.width * current_scale == up_w

                if result is None:
                    # allocate the result image
                    scale = current_scale
                    result = np.zeros((h * scale, w * scale, c), dtype=np.float32)

                assert current_scale == scale

                # remove overlap padding
                upscale_result = pad.scale(scale).remove_from(upscale_result)

                # copy into result image
                tile.scale(scale).write_into(result, upscale_result)

    assert result is not None
    return result
