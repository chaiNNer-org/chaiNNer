from typing import Tuple

import numpy as np

from ...utils.utils import get_h_w_c
from ..image_op import ImageOp, clipped
from ..image_utils import as_target_channels


def with_black_and_white_backgrounds(img: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    c = get_h_w_c(img)[2]
    assert c == 4

    black = np.copy(img[:, :, :3])
    white = np.copy(img[:, :, :3])
    for c in range(3):
        black[:, :, c] *= img[:, :, 3]
        white[:, :, c] = (white[:, :, c] - 1) * img[:, :, 3] + 1

    return black, white


def convenient_upscale(
    img: np.ndarray,
    model_in_nc: int,
    model_out_nc: int,
    upscale: ImageOp,
) -> np.ndarray:
    """
    Upscales the given image in an intuitive/convenient way.

    This method guarantees that the `upscale` function will be called with an image with
    `model_in_nc` number of channels.

    Additionally, guarantees that the number of channels of the output image will match
    that of the input image in cases where `model_in_nc` == `model_out_nc`, and match
    `model_out_nc` otherwise.
    """
    in_img_c = get_h_w_c(img)[2]

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

        # Transparency hack (white/black background difference alpha)
        black, white = with_black_and_white_backgrounds(img)
        black_up = as_target_channels(
            upscale(as_target_channels(black, model_in_nc, True)), 3, True
        )
        white_up = as_target_channels(
            upscale(as_target_channels(white, model_in_nc, True)), 3, True
        )

        # Interpolate between the alpha values to get a less noisy alpha
        alpha_candidates = 1 - (white_up - black_up)
        alpha_min = np.min(alpha_candidates, axis=2)
        alpha_max = np.max(alpha_candidates, axis=2)
        alpha_mean = np.mean(alpha_candidates, axis=2)
        alpha = alpha_max * alpha_mean + alpha_min * (1 - alpha_mean)

        return np.dstack((black_up, alpha))

    return as_target_channels(
        upscale(as_target_channels(img, model_in_nc, True)), in_img_c, True
    )
