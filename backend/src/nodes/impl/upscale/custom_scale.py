import math

import numpy as np

from nodes.impl.image_op import ImageOp
from nodes.impl.resize import ResizeFilter, resize
from nodes.utils.utils import get_h_w_c


def custom_scale_upscale(
    img: np.ndarray,
    upscale: ImageOp,
    natural_scale: int,
    custom_scale: int,
    separate_alpha: bool,
) -> np.ndarray:
    if custom_scale == natural_scale:
        return upscale(img)

    # number of iterations we need to do to reach the desired scale
    # e.g. if the model is 2x and the desired scale is 13x, we need to do 4 iterations
    iterations = max(1, math.ceil(math.log(custom_scale, natural_scale)))
    org_h, org_w, _ = get_h_w_c(img)
    for _ in range(iterations):
        img = upscale(img)

    # resize, if necessary
    target_size = (
        org_w * custom_scale,
        org_h * custom_scale,
    )
    h, w, _ = get_h_w_c(img)
    if (w, h) != target_size:
        img = resize(
            img,
            target_size,
            ResizeFilter.BOX,
            separate_alpha=separate_alpha,
        )

    return img
