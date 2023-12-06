from __future__ import annotations

import numpy as np

__author__ = "Daniel Steinberg"
__copyright__ = "Copyright 2022, Daniel Steinberg"
__credits__ = ["Daniel Steinberg"]
__license__ = "MIT"
__version__ = "1.0.0"
__maintainer__ = "Daniel Steinberg"
__link__ = "https://github.com/dstein64/colortrans"


def principal_color_transfer(
    img: np.ndarray,
    ref_img: np.ndarray,
    valid_indices: np.ndarray,
    ref_valid_indices: np.ndarray,
) -> np.ndarray:
    """
    Transfers the color distribution from the source to the target image using
    Principal Component Color Matching.

    This implementation is based on:
    - Kotera, Hiroaki, Hung-Shing Chen, and Tetsuro Morimoto.
        "Object-to-Object Color Mapping by Image Segmentation." In Color Imaging:
        Device-Independent Color, Color Hardcopy, and Graphic Arts IV, 3648:148-57.
        SPIE, 1998.
    - Kotera, Hiroaki. "A Scene-Referred Color Transfer for Pleasant Imaging
        on Display." In IEEE International Conference on Image Processing 2005,
        2:II-5, 2005.
    """

    shape = img.shape

    # Convert HxWxC image to a (H*W)xC matrix.
    content = img.reshape(-1, shape[-1])
    reference = ref_img.reshape(-1, shape[-1])

    valid_content = img[valid_indices]
    valid_reference = ref_img[ref_valid_indices]

    mu_content = np.mean(valid_content, axis=0)
    mu_reference = np.mean(valid_reference, axis=0)

    cov_content = np.cov(valid_content, rowvar=False)
    cov_reference = np.cov(valid_reference, rowvar=False)

    eigval_content, eigvec_content = np.linalg.eig(cov_content)
    eigval_reference, eigvec_reference = np.linalg.eig(cov_reference)

    # Division by 0 is forbidden: change null values to arbitrary values
    eigval_content = np.where(eigval_content == 0, 1e-42, eigval_content)
    eigval_factor = eigval_reference / eigval_content

    scaling = np.diag(np.sqrt(eigval_factor.clip(min=0)))
    transform = eigvec_reference.dot(scaling).dot(eigvec_content.T)
    transfer = (content - mu_content).dot(transform.T) + mu_reference

    # Restore image dimensions.
    transfer = transfer.reshape(shape).clip(0, 1)

    return transfer
