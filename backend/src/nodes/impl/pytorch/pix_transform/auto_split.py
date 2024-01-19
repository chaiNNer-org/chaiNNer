from __future__ import annotations

import gc

import numpy as np
import torch

from ....utils.utils import Region, Size, get_h_w_c
from ...image_op import to_op
from ...upscale.auto_split import Split, auto_split
from ...upscale.grayscale import SplitMode, grayscale_split
from ...upscale.passthrough import passthrough_single_color
from ...upscale.tiler import Tiler
from ..utils import safe_cuda_cache_empty
from .pix_transform import Params, pix_transform


class _PixTiler(Tiler):
    def __init__(self, max_tile_size: int = 2048) -> None:
        self.max_tile_size: int = max_tile_size

    def allow_smaller_tile_size(self) -> bool:
        return False

    def starting_tile_size(self, width: int, height: int, _channels: int) -> Size:
        square = min(width, height, self.max_tile_size)
        return square, square

    def split(self, tile_size: Size) -> Size:
        # half the tile size plus a bit extra to account for overlap
        size = tile_size[0] // 2 + tile_size[0] // 8
        if size < 16:
            raise ValueError("Cannot split any further.")
        return size, size


def _as_3d(img: np.ndarray) -> np.ndarray:
    if img.ndim == 3:
        return img
    return np.expand_dims(img, axis=2)


def pix_transform_auto_split(
    source: np.ndarray,
    guide: np.ndarray,
    device: torch.device,
    params: Params,
    split_mode: SplitMode = SplitMode.LAB,
) -> np.ndarray:
    """
    Automatically splits the source and guide image into segments that can be processed by PixTransform.

    The source and guide image may have any number of channels and any size, also long as the size of the guide image is a whole number (greater than 1) multiple of the size of the source image.
    """

    s_w, s_h, _ = get_h_w_c(source)
    g_w, g_h, _ = get_h_w_c(guide)

    if not (g_h > s_h and g_w > s_w):
        raise ValueError("The guide image must be larger than the source image.")
    if not (g_w / s_w == g_w // s_w and g_w / s_w == g_h / s_h):
        raise ValueError(
            "The size of the guide image must be an integer multiple of the size of the source image (e.g. 2x, 3x, 4x, ...)."
        )

    tiler = _PixTiler()
    scale = g_w // s_w

    def upscale(tile: np.ndarray, region: Region):
        try:
            tile_guide = region.scale(scale).read_from(guide)
            pix_op = to_op(pix_transform)(
                guide_img=np.transpose(_as_3d(tile_guide), (2, 0, 1)),
                device=device,
                params=params,
            )
            # passthrough single colors to speed up alpha channels
            pass_op = to_op(passthrough_single_color)(scale, pix_op)

            return grayscale_split(tile, pass_op, split_mode)
        except RuntimeError as e:
            # Check to see if its actually the CUDA out of memory error
            if "allocate" in str(e) or "CUDA" in str(e):
                # Collect garbage (clear VRAM)
                gc.collect()
                safe_cuda_cache_empty()
                return Split()
            else:
                # Re-raise the exception if not an OOM error
                raise

    try:
        return auto_split(source, upscale, tiler)
    finally:
        del device
        gc.collect()
        safe_cuda_cache_empty()
