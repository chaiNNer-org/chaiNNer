from __future__ import annotations

import numpy as np

from api import Progress

from ...utils.utils import get_h_w_c
from ..image_op import ImageOp, clipped
from ..image_utils import as_target_channels


class SplitProgress:
    """
    A mutable progress wrapper that can be focused on different sub-ranges.

    This allows a single ImageOp closure to use different progress ranges
    without needing to recreate the closure. The closure references `split.current`
    which changes when `focus()` is called.

    Example usage:
        split = SplitProgress(context)
        upscale_op = lambda img: upscale(img, model, split.current)

        # First operation uses 0-50% of progress
        split.focus(0, 0.5)
        result1 = upscale_op(img1)

        # Second operation uses 50-100% of progress
        split.focus(0.5, 0.5)
        result2 = upscale_op(img2)
    """

    def __init__(self, progress: Progress | None):
        self._progress = progress
        self._current: Progress | None = progress

    def focus(self, offset: float, length: float) -> None:
        """Focus on a sub-range of the total progress."""
        if self._progress is not None:
            self._current = self._progress.sub_progress(offset, length)
        else:
            self._current = None

    def reset(self) -> None:
        """Reset to use the full progress range."""
        self._current = self._progress

    @property
    def current(self) -> Progress | None:
        """Get the current (possibly focused) progress."""
        return self._current


def with_black_and_white_backgrounds(img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    c = get_h_w_c(img)[2]
    assert c == 4

    black = np.copy(img[:, :, :3])
    white = np.copy(img[:, :, :3])
    for c in range(3):
        black[:, :, c] *= img[:, :, 3]
        white[:, :, c] = (white[:, :, c] - 1) * img[:, :, 3] + 1

    return black, white


def denoise_and_flatten_alpha(img: np.ndarray) -> np.ndarray:
    alpha_min = np.min(img, axis=2)
    alpha_max = np.max(img, axis=2)
    alpha_mean = np.mean(img, axis=2)
    alpha = alpha_max * alpha_mean + alpha_min * (1 - alpha_mean)
    return alpha.clip(0, 1)


def convenient_upscale(
    img: np.ndarray,
    model_in_nc: int,
    model_out_nc: int,
    upscale: ImageOp,
    separate_alpha: bool = False,
    clip: bool = True,
    split_progress: SplitProgress | None = None,
) -> np.ndarray:
    """
    Upscales the given image in an intuitive/convenient way.

    This method guarantees that the `upscale` function will be called with an image with
    `model_in_nc` number of channels.

    Additionally, guarantees that the number of channels of the output image will match
    that of the input image in cases where `model_in_nc` == `model_out_nc`, and match
    `model_out_nc` otherwise.

    When multiple upscale operations are needed (e.g., for RGBA images) and a `split_progress`
    is provided, progress is automatically divided between them using sub-progress ranges.
    The `upscale` ImageOp should reference `split_progress.current` to get the correct
    progress for each operation.
    """
    in_img_c = get_h_w_c(img)[2]

    if clip:
        upscale = clipped(upscale)

    if model_in_nc != model_out_nc:
        return upscale(as_target_channels(img, model_in_nc, True))

    if in_img_c == model_in_nc:
        return upscale(img)

    if in_img_c == 4:
        # Ignore alpha if single-color or not being replaced
        unique = np.unique(img[:, :, 3])
        if len(unique) == 1:
            rgb = as_target_channels(
                upscale(as_target_channels(img[:, :, :3], model_in_nc, True)), 3, True
            )
            unique_alpha = np.full(rgb.shape[:-1], unique[0], np.float32)
            return np.dstack((rgb, unique_alpha))

        if separate_alpha:
            # Upscale the RGB channels and alpha channel separately
            # Split progress: 50% for RGB, 50% for alpha
            if split_progress:
                split_progress.focus(0, 0.5)
            rgb = as_target_channels(
                upscale(as_target_channels(img[:, :, :3], model_in_nc, True)), 3, True
            )
            if split_progress:
                split_progress.focus(0.5, 0.5)
            alpha = denoise_and_flatten_alpha(
                upscale(as_target_channels(img[:, :, 3], model_in_nc, True))
            )
            return np.dstack((rgb, alpha))
        else:
            # Transparency hack (white/black background difference alpha)
            # Split progress: 50% for black background, 50% for white background
            black, white = with_black_and_white_backgrounds(img)
            if split_progress:
                split_progress.focus(0, 0.5)
            black_up = as_target_channels(
                upscale(as_target_channels(black, model_in_nc, True)), 3, True
            )
            if split_progress:
                split_progress.focus(0.5, 0.5)
            white_up = as_target_channels(
                upscale(as_target_channels(white, model_in_nc, True)), 3, True
            )

            # Interpolate between the alpha values to get a more defined alpha
            alpha_candidates = 1 - (white_up - black_up)  #  type: ignore
            alpha = denoise_and_flatten_alpha(alpha_candidates)

            return np.dstack((black_up, alpha))

    return as_target_channels(
        upscale(as_target_channels(img, model_in_nc, True)), in_img_c, True
    )
