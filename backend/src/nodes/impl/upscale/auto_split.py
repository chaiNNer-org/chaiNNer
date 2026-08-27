from __future__ import annotations

import math
from collections.abc import Callable
from typing import Protocol

import numpy as np

from api import Progress
from logger import logger

from ...utils.utils import Region, Size, get_h_w_c
from ..oom import OomRecoveryExhaustedError, is_cuda_oom, is_non_oom_error
from .exact_split import exact_split
from .tile_blending import BlendDirection, TileBlender, TileOverlap, half_sin_blend_fn
from .tiler import Tiler


class Split:
    pass


class OomCleanup(Protocol):
    def __call__(self) -> None: ...


SplitImageOp = Callable[[np.ndarray, Region], np.ndarray | Split]


def auto_split(
    img: np.ndarray,
    upscale: SplitImageOp,
    tiler: Tiler,
    overlap: int = 16,
    progress: Progress | None = None,
    oom_cleanup: OomCleanup | None = None,
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
        progress=progress,
        oom_cleanup=oom_cleanup,
    )


class _SplitEx(Exception):
    pass


def _exact_split(
    img: np.ndarray,
    upscale: SplitImageOp,
    starting_tile_size: Size,
    split_tile_size: Callable[[Size], Size],
    overlap: int,
    progress: Progress | None = None,
    oom_cleanup: OomCleanup | None = None,
) -> np.ndarray:
    h, w, c = get_h_w_c(img)
    logger.debug(
        "Exact size split image (%dx%dpx @ %d) with exact tile size %dx%dpx.",
        w,
        h,
        c,
        starting_tile_size[0],
        starting_tile_size[1],
    )

    def no_split_upscale(i: np.ndarray, r: Region) -> np.ndarray:
        result = upscale(i, r)
        if isinstance(result, Split):
            raise _SplitEx
        return result

    max_overlap = min(*starting_tile_size) // 4
    try:
        return exact_split(
            img=img,
            exact_size=starting_tile_size,
            upscale=no_split_upscale,
            overlap=min(max_overlap, overlap),
            progress=progress,
        )
    except _SplitEx:
        # The upscale requested a split (OOM) — manual mode does not retry.
        if oom_cleanup is not None:
            oom_cleanup()
        raise OomRecoveryExhaustedError(
            original_error=RuntimeError("VRAM out of memory during exact split"),
            attempts=0,
            last_tile_size=starting_tile_size,
        ) from None
    except Exception as e:
        if is_non_oom_error(e):
            raise
        if not is_cuda_oom(e):
            # Unrelated error — propagate unchanged.
            raise
        # Recognized GPU OOM error — manual mode does not retry.
        if oom_cleanup is not None:
            oom_cleanup()
        raise OomRecoveryExhaustedError(
            original_error=e,
            attempts=0,
            last_tile_size=starting_tile_size,
        ) from None


def _max_split(
    img: np.ndarray,
    upscale: SplitImageOp,
    starting_tile_size: Size,
    split_tile_size: Callable[[Size], Size],
    overlap: int,
    progress: Progress | None = None,
    oom_cleanup: OomCleanup | None = None,
) -> np.ndarray:
    """
    Splits the image into tiles with at most the given tile size.

    If the upscale method requests a split, then the tile size will be lowered.
    """

    h, w, c = get_h_w_c(img)

    img_region = Region(0, 0, w, h)

    max_tile_size = starting_tile_size
    logger.debug(
        "Auto split image (%dx%dpx @ %d) with initial tile size %s.",
        w,
        h,
        c,
        max_tile_size,
    )

    if w <= max_tile_size[0] and h <= max_tile_size[1]:
        try:
            upscale_result = upscale(img, img_region)
        except Exception as e:
            if not is_cuda_oom(e) and not isinstance(e, _SplitEx):
                raise
            upscale_result = Split()

        if not isinstance(upscale_result, Split):
            if progress is not None:
                progress.set_progress(1.0, max_tile_size[0])
            return upscale_result

        try:
            max_tile_size = split_tile_size(max_tile_size)
        except ValueError:
            # Cannot reduce tile size further
            raise OomRecoveryExhaustedError(
                original_error=ValueError(
                    "Unable to upscale the whole image at once - minimum tile size reached"
                ),
                attempts=0,
                last_tile_size=max_tile_size,
            ) from None

        if oom_cleanup is not None:
            oom_cleanup()
        logger.warning(
            "Unable to upscale the whole image at once. Reduced tile size to %s.",
            max_tile_size,
        )

    start_y = 0

    # To allocate the result image, we need to know the upscale factor first,
    # and we only get to know this factor after the first successful upscale.
    result: TileBlender | None = None
    scale: int = 0
    out_channels: int = 0
    oom_attempts = 0
    last_error: BaseException | None = None
    max_attempts = 20  # Match _exact_split limit

    restart = True
    while restart and oom_attempts < max_attempts:
        restart = False
        break_outer = False

        tile_count_x = math.ceil(w / max_tile_size[0])
        tile_count_y = math.ceil(h / max_tile_size[1])
        tile_size_x = math.ceil(w / tile_count_x)
        tile_size_y = math.ceil(h / tile_count_y)
        total_tiles = tile_count_x * tile_count_y

        logger.debug(
            "Currently %dx%d tiles each %dx%dpx.",
            tile_count_x,
            tile_count_y,
            tile_size_x,
            tile_size_y,
        )

        prev_row_result: TileBlender | None = None
        tiles_processed = 0

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

                try:
                    upscale_result = upscale(padded_tile.read_from(img), padded_tile)
                except Exception as e:
                    last_error = e
                    if not is_cuda_oom(e) and not isinstance(e, _SplitEx):
                        raise
                    # Handle OOM exception from upscale
                    try:
                        max_tile_size = split_tile_size(max_tile_size)
                    except ValueError:
                        # Cannot reduce tile size further
                        break_outer = True
                        break
                    oom_attempts += 1
                    if oom_cleanup is not None:
                        oom_cleanup()
                    logger.warning(
                        "VRAM OOM recovery: retrying with tile size %dx%d (attempt %d) after error: %s",
                        max_tile_size[0],
                        max_tile_size[1],
                        oom_attempts,
                        str(e)[:100],
                    )
                    # Discard partial output: tiles at the smaller size won't align
                    # with the rows already blended at the previous tile size.
                    result = None
                    scale = 0
                    out_channels = 0
                    start_y = 0
                    restart = True
                    break_outer = True
                    break

                if isinstance(upscale_result, Split):
                    try:
                        max_tile_size = split_tile_size(max_tile_size)
                    except ValueError:
                        # Cannot reduce tile size further
                        last_error = ValueError("Minimum tile size reached")
                        break_outer = True
                        break
                    oom_attempts += 1

                    if oom_cleanup is not None:
                        oom_cleanup()

                    logger.warning(
                        "VRAM OOM recovery: retrying with tile size %dx%d (attempt %d)",
                        max_tile_size[0],
                        max_tile_size[1],
                        oom_attempts,
                    )

                    new_tile_count_y = math.ceil(h / max_tile_size[1])
                    new_tile_size_y = math.ceil(h / new_tile_count_y)
                    start_y = (y * tile_size_x) // new_tile_size_y

                    logger.debug(
                        "Split occurred. New tile size is %s. Starting at row %d.",
                        max_tile_size,
                        start_y,
                    )

                    if result is not None:
                        result.offset = start_y * new_tile_size_y

                    restart = True
                    break_outer = True
                    break

                up_h, up_w, up_c = get_h_w_c(upscale_result)
                current_scale = up_h // padded_tile.height
                assert current_scale > 0
                assert padded_tile.height * current_scale == up_h
                assert padded_tile.width * current_scale == up_w

                if row_result is None:
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

                row_result.add_tile(
                    upscale_result, TileOverlap(pad.left * scale, pad.right * scale)
                )

                tiles_processed += 1
                if progress is not None:
                    progress.set_progress(
                        tiles_processed / total_tiles, max_tile_size[0]
                    )

            if restart or break_outer:
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

            result.add_tile(row_result.get_result(), row_overlap)

        # End of for loops

        if not restart and not break_outer:
            # All tiles were processed successfully.
            assert result is not None
            return result.get_result()

    # Exhausted retries or unable to reduce tile size further.
    if last_error is None:
        last_error = ValueError("Unable to upscale image within tile size limits")
    raise OomRecoveryExhaustedError(
        original_error=last_error,
        attempts=oom_attempts,
        last_tile_size=max_tile_size,
    )
