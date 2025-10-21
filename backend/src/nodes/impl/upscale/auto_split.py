from __future__ import annotations

import math
from typing import Callable, Union

import numpy as np

from logger import get_logger_from_env

logger = get_logger_from_env()

from ...utils.utils import Region, Size, get_h_w_c
from .exact_split import exact_split
from .tile_blending import BlendDirection, TileBlender, TileOverlap, half_sin_blend_fn
from .tiler import Tiler


class Split:
    pass


SplitImageOp = Callable[[np.ndarray, Region], Union[np.ndarray, Split]]


def auto_split(
    img: np.ndarray,
    upscale: SplitImageOp,
    tiler: Tiler,
    overlap: int = 16,
) -> np.ndarray:
    """
    Splits the image into tiles according to the given tiler.

    This method only changes the size of the given image, the tiles passed into the upscale function will have same number of channels.

    The region passed into the upscale function is the region of the current tile.
    The size of the region is guaranteed to be the same as the size of the given tile.

    ## Padding

    If the given tiler allows smaller tile sizes, then it is guaranteed that no padding will be added.
    Otherwise, no padding is only guaranteed if the starting tile size is not larger than the size of the given image.
    """

    h, w, c = get_h_w_c(img)
    split = _max_split if tiler.allow_smaller_tile_size() else _exact_split

    return split(
        img,
        upscale=upscale,
        starting_tile_size=tiler.starting_tile_size(w, h, c),
        split_tile_size=tiler.split,
        overlap=overlap,
    )


class _SplitEx(Exception):
    pass


def _exact_split(
    img: np.ndarray,
    upscale: SplitImageOp,
    starting_tile_size: Size,
    split_tile_size: Callable[[Size], Size],
    overlap: int,
) -> np.ndarray:
    h, w, c = get_h_w_c(img)
    logger.debug(
        f"Exact size split image ({w}x{h}px @ {c}) with exact tile size {starting_tile_size[0]}x{starting_tile_size[1]}px."
    )

    def no_split_upscale(i: np.ndarray, r: Region) -> np.ndarray:
        result = upscale(i, r)
        if isinstance(result, Split):
            raise _SplitEx
        return result

    MAX_ITER = 20  # noqa: N806

    for _ in range(MAX_ITER):
        try:
            max_overlap = min(*starting_tile_size) // 4
            return exact_split(
                img=img,
                exact_size=starting_tile_size,
                upscale=no_split_upscale,
                overlap=min(max_overlap, overlap),
            )
        except _SplitEx:
            starting_tile_size = split_tile_size(starting_tile_size)

    raise ValueError(f"Aborting after {MAX_ITER} splits. Unable to upscale image.")


def _max_split(
    img: np.ndarray,
    upscale: SplitImageOp,
    starting_tile_size: Size,
    split_tile_size: Callable[[Size], Size],
    overlap: int,
) -> np.ndarray:
    """
    Splits the image into tiles with at most the given tile size.

    If the upscale method requests a split, then the tile size will be lowered.
    """

    h, w, c = get_h_w_c(img)

    img_region = Region(0, 0, w, h)

    max_tile_size = starting_tile_size
    logger.debug(
        f"Auto split image ({w}x{h}px @ {c}) with initial tile size {max_tile_size}."
    )

    if w <= max_tile_size[0] and h <= max_tile_size[1]:
        # the image might be small enough so that we don't have to split at all
        upscale_result = upscale(img, img_region)
        if not isinstance(upscale_result, Split):
            return upscale_result

        # the image was too large
        max_tile_size = split_tile_size(max_tile_size)

        logger.warning(
            f"Unable to upscale the whole image at once. Reduced tile size to {max_tile_size}."
        )

    # The upscale method is allowed to request splits at any time.
    # When a split occurs, we have to "restart" the loop and
    # this variable allow us to split the already processed tiles.
    start_y = 0

    # To allocate the result image, we need to know the upscale factor first,
    # and we only get to know this factor after the first successful upscale.
    result: TileBlender | None = None
    scale: int = 0
    out_channels: int = 0

    restart = True
    while restart:
        restart = False

        # This is a bit complex.
        # We don't actually use the current tile size to partition the image.
        # If we did, then tile_size=1024 and w=1200 would result in very uneven tiles.
        # Instead, we use tile_size to calculate how many tiles we get in the x and y direction
        # and then calculate the optimal tile size for the x and y direction using the counts.
        # This yields optimal tile sizes which should prevent unnecessary splitting.
        tile_count_x = math.ceil(w / max_tile_size[0])
        tile_count_y = math.ceil(h / max_tile_size[1])
        tile_size_x = math.ceil(w / tile_count_x)
        tile_size_y = math.ceil(h / tile_count_y)

        logger.debug(
            f"Currently {tile_count_x}x{tile_count_y} tiles each {tile_size_x}x{tile_size_y}px."
        )

        prev_row_result: TileBlender | None = None

        for y in range(tile_count_y):
            if y < start_y:
                continue

            row_result: TileBlender | None = None
            row_overlap: TileOverlap | None = None

            for x in range(tile_count_x):
                tile = Region(
                    x * tile_size_x, y * tile_size_y, tile_size_x, tile_size_y
                ).intersect(img_region)
                pad = img_region.child_padding(tile).min(overlap)
                padded_tile = tile.add_padding(pad)

                upscale_result = upscale(padded_tile.read_from(img), padded_tile)

                if isinstance(upscale_result, Split):
                    max_tile_size = split_tile_size(max_tile_size)

                    new_tile_count_y = math.ceil(h / max_tile_size[1])
                    new_tile_size_y = math.ceil(h / new_tile_count_y)
                    start_y = (y * tile_size_x) // new_tile_size_y

                    logger.debug(
                        f"Split occurred. New tile size is {max_tile_size}. Starting at row {start_y}."
                    )

                    # reset result
                    if result is not None:
                        # we already added at least one row, so we have to set the offset back
                        result.offset = start_y * new_tile_size_y

                    restart = True
                    break

                # figure out by how much the image was upscaled by
                up_h, up_w, up_c = get_h_w_c(upscale_result)
                current_scale = up_h // padded_tile.height
                assert current_scale > 0
                assert padded_tile.height * current_scale == up_h
                assert padded_tile.width * current_scale == up_w

                if row_result is None:
                    # allocate the result image
                    scale = current_scale
                    out_channels = up_c
                    row_result = TileBlender(
                        width=w * scale,
                        height=padded_tile.height * scale,
                        channels=out_channels,
                        direction=BlendDirection.X,
                        blend_fn=half_sin_blend_fn,
                        _prev=prev_row_result,
                    )
                    prev_row_result = row_result
                    row_overlap = TileOverlap(pad.top * scale, pad.bottom * scale)

                assert current_scale == scale

                # add to row
                row_result.add_tile(
                    upscale_result, TileOverlap(pad.left * scale, pad.right * scale)
                )

            if restart:
                break

            assert row_result is not None
            assert row_overlap is not None

            if result is None:
                result = TileBlender(
                    width=w * scale,
                    height=h * scale,
                    channels=out_channels,
                    direction=BlendDirection.Y,
                    blend_fn=half_sin_blend_fn,
                )

            # add row
            result.add_tile(row_result.get_result(), row_overlap)

    assert result is not None
    return result.get_result()
