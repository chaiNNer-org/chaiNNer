from __future__ import annotations

from collections.abc import Callable

import numpy as np

from api import Progress

from ...utils.utils import get_h_w_c
from ..image_utils import as_target_channels

# An upscale operation that takes an image and optional progress, returning the upscaled image
ProgressImageOp = Callable[[np.ndarray, Progress | None], np.ndarray]


def _clipped(op: ProgressImageOp) -> ProgressImageOp:
    def inner(img: np.ndarray, progress: Progress | None) -> np.ndarray:
        return np.clip(op(img, progress), 0, 1)

    return inner


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
    upscale: ProgressImageOp,
    separate_alpha: bool = False,
    clip: bool = True,
    progress: Progress | None = None,
) -> np.ndarray:
    """
    Upscales the given image in an intuitive/convenient way.

    This method guarantees that the `upscale` function will be called with an image with
    `model_in_nc` number of channels.

    Additionally, guarantees that the number of channels of the output image will match
    that of the input image in cases where `model_in_nc` == `model_out_nc`, and match
    `model_out_nc` otherwise.

    When multiple upscale operations are needed (e.g., for RGBA images), progress is
    automatically divided between them using sub-progress ranges.
    """
    in_img_c = get_h_w_c(img)[2]

    if clip:
        upscale = _clipped(upscale)

    if model_in_nc != model_out_nc:
        return upscale(as_target_channels(img, model_in_nc, True), progress)

    if in_img_c == model_in_nc:
        return upscale(img, progress)

    if in_img_c == 4:
        # Ignore alpha if single-color or not being replaced
        unique = np.unique(img[:, :, 3])
        if len(unique) == 1:
            rgb = as_target_channels(
                upscale(as_target_channels(img[:, :, :3], model_in_nc, True), progress),
                3,
                True,
            )
            unique_alpha = np.full(rgb.shape[:-1], unique[0], np.float32)
            return np.dstack((rgb, unique_alpha))

        if separate_alpha:
            # Upscale the RGB channels and alpha channel separately
            # Split progress: 50% for RGB, 50% for alpha
            rgb_progress = progress.sub_progress(0, 0.5) if progress else None
            alpha_progress = progress.sub_progress(0.5, 0.5) if progress else None

            rgb = as_target_channels(
                upscale(
                    as_target_channels(img[:, :, :3], model_in_nc, True), rgb_progress
                ),
                3,
                True,
            )
            alpha = denoise_and_flatten_alpha(
                upscale(
                    as_target_channels(img[:, :, 3], model_in_nc, True), alpha_progress
                )
            )
            return np.dstack((rgb, alpha))
        else:
            # Transparency hack (white/black background difference alpha)
            # Split progress: 50% for black background, 50% for white background
            black_progress = progress.sub_progress(0, 0.5) if progress else None
            white_progress = progress.sub_progress(0.5, 0.5) if progress else None

            black, white = with_black_and_white_backgrounds(img)
            black_up = as_target_channels(
                upscale(as_target_channels(black, model_in_nc, True), black_progress),
                3,
                True,
            )
            white_up = as_target_channels(
                upscale(as_target_channels(white, model_in_nc, True), white_progress),
                3,
                True,
            )

            # Interpolate between the alpha values to get a more defined alpha
            alpha_candidates = 1 - (white_up - black_up)  #  type: ignore
            alpha = denoise_and_flatten_alpha(alpha_candidates)

            return np.dstack((black_up, alpha))

    return as_target_channels(
        upscale(as_target_channels(img, model_in_nc, True), progress), in_img_c, True
    )
