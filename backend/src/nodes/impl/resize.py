from __future__ import annotations

from enum import Enum

import numpy as np
from chainner_ext import ResizeFilter as NativeResizeFilter
from chainner_ext import resize as native_resize

from ..utils.utils import get_h_w_c


class ResizeFilter(Enum):
    AUTO = -1
    NEAREST = 0
    BOX = 4
    LINEAR = 2
    CATROM = 3
    LANCZOS = 1

    HERMITE = 5
    MITCHELL = 6
    BSPLINE = 7
    HAMMING = 8
    HANN = 9
    LAGRANGE = 10
    GAUSS = 11


_FILTER_MAP: dict[ResizeFilter, NativeResizeFilter] = {
    ResizeFilter.NEAREST: NativeResizeFilter.Nearest,
    ResizeFilter.BOX: NativeResizeFilter.Box,
    ResizeFilter.LINEAR: NativeResizeFilter.Linear,
    ResizeFilter.CATROM: NativeResizeFilter.CubicCatrom,
    ResizeFilter.LANCZOS: NativeResizeFilter.Lanczos,
    ResizeFilter.HERMITE: NativeResizeFilter.Hermite,
    ResizeFilter.MITCHELL: NativeResizeFilter.CubicMitchell,
    ResizeFilter.BSPLINE: NativeResizeFilter.CubicBSpline,
    ResizeFilter.HAMMING: NativeResizeFilter.Hamming,
    ResizeFilter.HANN: NativeResizeFilter.Hann,
    ResizeFilter.LAGRANGE: NativeResizeFilter.Lagrange,
    ResizeFilter.GAUSS: NativeResizeFilter.Gauss,
}


def resize(
    img: np.ndarray,
    out_dims: tuple[int, int],
    filter: ResizeFilter,
    separate_alpha: bool = False,
    gamma_correction: bool = False,
) -> np.ndarray:
    h, w, c = get_h_w_c(img)
    new_w, new_h = out_dims

    # check memory
    GB: int = 2**30  # noqa: N806
    MAX_MEMORY = 16 * GB  # noqa: N806
    new_memory = new_w * new_h * c * 4
    if new_memory > MAX_MEMORY:
        raise RuntimeError(
            f"Resize would require {round(new_memory / GB, 3)} GB of memory, but only {MAX_MEMORY // GB} GB are allowed."
        )

    if filter == ResizeFilter.AUTO:
        # automatically chose a method that works
        if new_w > w or new_h > h:
            filter = ResizeFilter.LANCZOS
        else:
            filter = ResizeFilter.BOX

    if (w, h) == out_dims and (filter in (ResizeFilter.NEAREST, ResizeFilter.BOX)):
        # no resize needed
        return img.copy()

    if filter == ResizeFilter.NEAREST:
        # we don't need premultiplied alpha for NN
        separate_alpha = True

    native_filter = _FILTER_MAP[filter]

    if not separate_alpha and c == 4:
        # pre-multiply alpha
        img = img.copy()
        img[:, :, 0] *= img[..., 3]
        img[:, :, 1] *= img[..., 3]
        img[:, :, 2] *= img[..., 3]

    img = native_resize(img, out_dims, native_filter, gamma_correction)
    # native_resize guarantees that the output is float32 in the range [0, 1]
    # so no need to normalize

    if not separate_alpha and c == 4:
        # undo pre-multiply alpha
        alpha_r = 1 / np.maximum(img[..., 3], 0.0001)
        img[:, :, 0] *= alpha_r
        img[:, :, 1] *= alpha_r
        img[:, :, 2] *= alpha_r
        np.minimum(img, 1, out=img)

    return img
