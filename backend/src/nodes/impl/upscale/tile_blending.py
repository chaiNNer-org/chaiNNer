from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum
from typing import Callable

import numpy as np

from nodes.utils.utils import get_h_w_c


def sin_blend_fn(x: np.ndarray) -> np.ndarray:
    return (np.sin(x * math.pi - math.pi / 2) + 1) / 2


def half_sin_blend_fn(i: np.ndarray) -> np.ndarray:
    # only use half the overlap
    i = np.clip(i * 2 - 0.5, 0, 1)
    return sin_blend_fn(i)


class BlendDirection(Enum):
    X = 0
    Y = 1


@dataclass(frozen=True)
class TileOverlap:
    start: int
    end: int

    @property
    def total(self) -> int:
        return self.start + self.end


def _fast_mix(a: np.ndarray, b: np.ndarray, blend: np.ndarray) -> np.ndarray:
    """
    Returns `a * (1 - blend) + b * blend`
    """
    # a * (1 - blend) + b * blend
    # a - a * blend + b * blend
    r = b * blend
    r += a
    r -= a * blend  # type: ignore
    return r


class TileBlender:
    def __init__(
        self,
        width: int,
        height: int,
        channels: int,
        direction: BlendDirection,
        blend_fn: Callable[[np.ndarray], np.ndarray] = sin_blend_fn,
        _prev: TileBlender | None = None,
    ) -> None:
        self.direction: BlendDirection = direction
        self.blend_fn: Callable[[np.ndarray], np.ndarray] = blend_fn
        self.offset: int = 0
        self.last_end_overlap: int = 0
        self._last_blend: np.ndarray | None = None

        if (
            _prev is not None
            and _prev.direction == direction
            and _prev.width == width
            and _prev.height == height
            and _prev.channels == channels
        ):
            if _prev.blend_fn == blend_fn:
                # reuse blend
                self._last_blend = _prev._last_blend  # noqa: SLF001
            result = _prev.result
        else:
            result = np.zeros((height, width, channels), dtype=np.float32)
        self.result: np.ndarray = result

    @property
    def width(self) -> int:
        return self.result.shape[1]

    @property
    def height(self) -> int:
        return self.result.shape[0]

    @property
    def channels(self) -> int:
        return self.result.shape[2]

    def _get_blend(self, blend_size: int) -> np.ndarray:
        if self.direction == BlendDirection.X:
            if self._last_blend is not None and self._last_blend.shape[1] == blend_size:
                return self._last_blend

            blend = self.blend_fn(
                np.arange(blend_size, dtype=np.float32) / (blend_size - 1)
            )
            blend = blend.reshape((1, blend_size, 1))
            blend = np.repeat(blend, repeats=self.height, axis=0)
            blend = np.repeat(blend, repeats=self.channels, axis=2)
        else:
            if self._last_blend is not None and self._last_blend.shape[0] == blend_size:
                return self._last_blend

            blend = self.blend_fn(
                np.arange(blend_size, dtype=np.float32) / (blend_size - 1)
            )
            blend = blend.reshape((blend_size, 1, 1))
            blend = np.repeat(blend, repeats=self.width, axis=1)
            blend = np.repeat(blend, repeats=self.channels, axis=2)

        self._last_blend = blend
        return blend

    def add_tile(self, tile: np.ndarray, overlap: TileOverlap) -> None:
        h, w, c = get_h_w_c(tile)
        if c != self.channels:
            raise ValueError(f"Expected {self.channels} channels, but got {c} channels")
        o = overlap

        if self.direction == BlendDirection.X:
            if h != self.height:
                raise ValueError(f"Expected {self.height} pixels, but got {h} pixels")
            if w <= o.total:
                raise ValueError(
                    f"Expected at least {o.total} pixels, but got {w} pixels"
                )

            if self.offset == 0:
                # the first tile is copied in as is
                self.result[:, :w, ...] = tile

                if o.start != 0:
                    raise ValueError(
                        f"Expected the first tile to have an overlap of 0, but got {o.start}"
                    )
                self.offset += w - o.end
                self.last_end_overlap = o.end

            else:
                if self.offset >= self.width:
                    raise ValueError("All tiles were filled in already")

                if self.last_end_overlap < o.start:
                    # we can't use all the overlap of the current tile, so we have to cut it off
                    diff = o.start - self.last_end_overlap
                    tile = tile[:, diff:, ...]
                    h, w, c = get_h_w_c(tile)
                    o = TileOverlap(self.last_end_overlap, o.end)

                # copy over the part that doesn't need blending (yet)
                self.result[
                    :, self.offset + o.start : self.offset + w - o.start, ...
                ] = tile[:, o.start * 2 :, ...]

                # blend the overlapping part
                blend_size = o.start * 2
                blend = self._get_blend(blend_size)

                left = self.result[
                    :, self.offset - o.start : self.offset + o.start, ...
                ]
                right = tile[:, :blend_size, ...]

                self.result[
                    :, self.offset - o.start : self.offset + o.start, ...
                ] = _fast_mix(left, right, blend)

                self.offset += w - o.total
                self.last_end_overlap = o.end
        else:
            if w != self.width:
                raise ValueError(f"Expected {self.width} pixels, but got {w} pixels")
            if h <= o.total:
                raise ValueError(
                    f"Expected at least {o.total} pixels, but got {h} pixels"
                )

            if self.offset == 0:
                # the first tile is copied in as is
                self.result[:h, :, ...] = tile

                if o.start != 0:
                    raise ValueError(
                        f"Expected the first tile to have an overlap of 0, but got {o.start}"
                    )
                self.offset += h - o.end
                self.last_end_overlap = o.end

            else:
                if self.offset >= self.height:
                    raise RuntimeError("All tiles were filled in already")

                if self.last_end_overlap < o.start:
                    # we can't use all the overlap of the current tile, so we have to cut it off
                    diff = o.start - self.last_end_overlap
                    tile = tile[diff:, :, ...]
                    h, w, c = get_h_w_c(tile)
                    o = TileOverlap(self.last_end_overlap, o.end)

                # copy over the part that doesn't need blending
                self.result[
                    self.offset + o.start : self.offset + h - o.start, :, ...
                ] = tile[o.start * 2 :, :, ...]

                # blend the overlapping part
                blend_size = o.start * 2
                blend = self._get_blend(blend_size)

                left = self.result[
                    self.offset - o.start : self.offset + o.start, :, ...
                ]
                right = tile[: o.start * 2, :, ...]

                self.result[
                    self.offset - o.start : self.offset + o.start, :, ...
                ] = _fast_mix(left, right, blend)

                self.offset += h - o.total
                self.last_end_overlap = o.end

    def get_result(self) -> np.ndarray:
        if self.direction == BlendDirection.X and self.offset != self.width:
            raise ValueError(
                f"Expected {self.width} pixels, but got {self.offset} pixels"
            )
        elif self.offset != self.height:
            raise ValueError(
                f"Expected {self.height} pixels, but got {self.offset} pixels"
            )

        return self.result
