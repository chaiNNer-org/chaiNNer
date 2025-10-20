from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

import numpy as np
from logger import get_logger_from_env

logger = get_logger_from_env()

from ...utils.utils import Padding, Region, Size, get_h_w_c
from ..image_utils import BorderType, create_border
from .tile_blending import BlendDirection, TileBlender, TileOverlap, half_sin_blend_fn


def _pad_image(img: np.ndarray, min_size: Size):
    h, w, _ = get_h_w_c(img)

    min_w, min_h = min_size
    x = max(0, min_w - w) / 2
    y = max(0, min_h - h) / 2

    padding = Padding(math.floor(y), math.floor(x), math.ceil(y), math.ceil(x))

    return create_border(img, BorderType.REFLECT_MIRROR, padding), padding


@dataclass
class _Segment:
    start: int
    end: int
    start_padding: int
    end_padding: int

    @property
    def length(self) -> int:
        return self.end - self.start

    @property
    def padded_length(self) -> int:
        return self.end + self.end_padding - (self.start - self.start_padding)


def _exact_split_into_segments(length: int, exact: int, overlap: int) -> list[_Segment]:
    """
    Splits the given length into segments of `exact` (padded) length.
    Segments will overlap into each other with at least the given overlap.
    """
    if length == exact:
        # trivial
        return [_Segment(0, exact, 0, 0)]

    assert length > exact
    assert exact > overlap * 2

    result: list[_Segment] = []

    def add(s: _Segment):
        assert s.padded_length == exact
        result.append(s)

    # The current strategy is to go from left to right and to align segments
    # such that we use the least overlap possible. The last segment will then
    # be the smallest with potentially a lot of overlap.
    # While this is easy to implement, it's actually not ideal. Ideally, we
    # would want for the overlap to be distributed evenly between segments.
    # However, this is complex to implement and the current method also works.

    # we know that the first segment looks like this
    add(_Segment(0, exact - overlap, 0, overlap))

    while result[-1].end < length:
        start_padding = overlap
        start = result[-1].end
        end = start + exact - overlap * 2
        end_padding = overlap

        if end + end_padding >= length:
            # last segment
            end_padding = 0
            end = length
            start_padding = exact - (end - start)

        add(_Segment(start, end, start_padding, end_padding))

    return result


def _exact_split_into_regions(
    w: int,
    h: int,
    exact_w: int,
    exact_h: int,
    overlap: int,
) -> list[list[tuple[Region, Padding]]]:
    """
    Returns a list of disjoint regions along with padding.
    Each region plus its padding is guaranteed to have the given exact size.
    The padding (if not zero) is guaranteed to be at least the given overlap value.
    """

    # we can split x and y independently from each other and then combine the results
    x_segments = _exact_split_into_segments(w, exact_w, overlap)
    y_segments = _exact_split_into_segments(h, exact_h, overlap)

    logger.info(
        f"Image is split into {len(x_segments)}x{len(y_segments)} tiles each exactly {exact_w}x{exact_h}px."
    )

    result: list[list[tuple[Region, Padding]]] = []
    for y in y_segments:
        row: list[tuple[Region, Padding]] = []
        for x in x_segments:
            row.append(
                (
                    Region(x.start, y.start, x.length, y.length),
                    Padding(
                        y.start_padding, x.end_padding, y.end_padding, x.start_padding
                    ),
                )
            )
        result.append(row)
    return result


def _exact_split_without_padding(
    img: np.ndarray,
    exact_size: Size,
    upscale: Callable[[np.ndarray, Region], np.ndarray],
    overlap: int,
) -> np.ndarray:
    h, w, _ = get_h_w_c(img)
    exact_w, exact_h = exact_size
    assert w >= exact_w and h >= exact_h

    if (w, h) == exact_size:
        return upscale(img, Region(0, 0, w, h))

    # To allocate the result image, we need to know the upscale factor first,
    # and we only get to know this factor after the first successful upscale.
    result: TileBlender | None = None
    scale: int = 0
    out_channels: int = 0

    regions = _exact_split_into_regions(w, h, exact_w, exact_h, overlap)
    for row in regions:
        row_result: TileBlender | None = None
        row_overlap: TileOverlap | None = None

        for tile, pad in row:
            padded_tile = tile.add_padding(pad)
            assert padded_tile.size == exact_size

            upscale_result = upscale(padded_tile.read_from(img), padded_tile)

            # figure out by how much the image was upscaled by
            up_h, up_w, up_c = get_h_w_c(upscale_result)
            current_scale = up_h // exact_h
            assert current_scale > 0
            assert exact_h * current_scale == up_h
            assert exact_w * current_scale == up_w

            if row_result is None:
                # allocate the result image
                scale = current_scale
                out_channels = up_c
                row_result = TileBlender(
                    width=w * scale,
                    height=exact_h * scale,
                    channels=out_channels,
                    direction=BlendDirection.X,
                    blend_fn=half_sin_blend_fn,
                )
                row_overlap = TileOverlap(pad.top * scale, pad.bottom * scale)

            assert current_scale == scale

            row_result.add_tile(
                upscale_result, TileOverlap(pad.left * scale, pad.right * scale)
            )

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

    assert result is not None

    # remove initially added padding
    return result.get_result()


def exact_split(
    img: np.ndarray,
    exact_size: Size,
    upscale: Callable[[np.ndarray, Region], np.ndarray],
    overlap: int = 16,
) -> np.ndarray:
    """
    Splits the image into tiles with exactly the given tile size.

    If the image is smaller than the given size, then it will be padded.
    """

    # ensure that the image is at least as large as the given size
    img, base_padding = _pad_image(img, exact_size)
    h, w, _ = get_h_w_c(img)

    result = _exact_split_without_padding(img, exact_size, upscale, overlap)
    scale = get_h_w_c(result)[0] // h

    if base_padding.empty:
        return result

    # remove initially added padding
    return (
        Region(0, 0, w, h).remove_padding(base_padding).scale(scale).read_from(result)
    )
