import cv2
import numpy as np

from ..utils.utils import get_h_w_c


def diff_images(img1: np.ndarray, img2: np.ndarray) -> np.ndarray:
    """Calculates diff of input images"""

    h1, w1, c1 = get_h_w_c(img1)
    h2, w2, c2 = get_h_w_c(img2)

    if h1 != h2 or w1 != w2:
        raise ValueError("Diff inputs must have identical size")

    # adjust channels
    alpha1 = None
    alpha2 = None
    if c1 > 3:
        alpha1 = img1[:, :, 3:4]
        img1 = img1[:, :, :3]
    if c2 > 3:
        alpha2 = img2[:, :, 3:4]
        img2 = img2[:, :, :3]

    # Get difference between the images
    diff = img1 - img2  # type: ignore

    alpha_diff = None
    if alpha1 is not None or alpha2 is not None:
        # Don't alter RGB pixels if either input pixel is fully transparent,
        # since RGB diff is indeterminate for those pixels.
        if alpha1 is not None and alpha2 is not None:
            invalid_alpha_mask = (alpha1 == 0) | (alpha2 == 0)
        elif alpha1 is not None:
            invalid_alpha_mask = alpha1 == 0
        else:
            invalid_alpha_mask = alpha2 == 0
        invalid_alpha_indices = np.nonzero(invalid_alpha_mask)
        diff[invalid_alpha_indices] = 0

        if alpha1 is not None and alpha2 is not None:
            alpha_diff = alpha1 - alpha2  # type: ignore

    # add alpha back in
    if alpha_diff is not None:
        diff = np.concatenate([diff, alpha_diff], axis=2)

    return diff


def sum_images(
    input_img: np.ndarray,
    diff: np.ndarray,
) -> np.ndarray:
    """Calculates sum of input images"""

    input_h, input_w, input_c = get_h_w_c(input_img)
    diff_h, diff_w, diff_c = get_h_w_c(diff)

    # adjust channels
    alpha = None
    alpha_diff = None
    if input_c > 3:
        alpha = input_img[:, :, 3:4]
        input_img = input_img[:, :, :3]
    if diff_c > 3:
        alpha_diff = diff[:, :, 3:4]
        diff = diff[:, :, :3]

    if input_h != diff_h or input_w != diff_w:
        # Upsample the difference
        diff = cv2.resize(
            diff,
            (input_w, input_h),
            interpolation=cv2.INTER_CUBIC,
        )

        if alpha_diff is not None:
            alpha_diff = cv2.resize(
                alpha_diff,
                (input_w, input_h),
                interpolation=cv2.INTER_CUBIC,
            )
            alpha_diff = np.expand_dims(alpha_diff, 2)

    if alpha_diff is not None:
        # Don't alter alpha pixels if the input pixel is fully transparent, since
        # doing so would expose indeterminate RGB data.
        invalid_rgb_mask = alpha == 0
        invalid_rgb_indices = np.nonzero(invalid_rgb_mask)
        alpha_diff[invalid_rgb_indices] = 0

    result = input_img + diff
    if alpha_diff is not None:
        alpha = alpha + alpha_diff  # type: ignore

    # add alpha back in
    if alpha is not None:
        result = np.concatenate([result, alpha], axis=2)

    return result
