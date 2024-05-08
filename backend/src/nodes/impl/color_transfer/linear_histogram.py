from __future__ import annotations

import numpy as np

__author__ = "Daniel Steinberg"
__copyright__ = "Copyright 2022, Daniel Steinberg"
__credits__ = ["Daniel Steinberg"]
__license__ = "MIT"
__version__ = "1.0.0"
__maintainer__ = "Daniel Steinberg"
__link__ = "https://github.com/dstein64/colortrans"


def matrix_sqrt(x: np.ndarray):
    eig_val, eig_vec = np.linalg.eig(x)
    return eig_vec.dot(np.diag(np.sqrt(eig_val.clip(min=0)))).dot(eig_vec.T)


def linear_histogram_transfer(
    img: np.ndarray,
    ref_img: np.ndarray,
    valid_indices: np.ndarray,
    ref_valid_indices: np.ndarray,
) -> np.ndarray:
    """
    Transfers the color distribution from the source to the target image
    using the Linear Histogram Matching..

    This implementation is based on to the Hertzmann, Aaron. "Algorithms
    for Rendering in Artistic Styles." Ph.D., New York University, 2001.
    """

    shape = img.shape

    # Convert HxWxC image to a (H*W)xC matrix.
    content = img.reshape(-1, shape[-1])

    valid_content = img[valid_indices]
    valid_reference = ref_img[ref_valid_indices]

    mu_content = np.mean(valid_content, axis=0)
    mu_reference = np.mean(valid_reference, axis=0)

    cov_content = np.cov(valid_content, rowvar=False)
    cov_reference = np.cov(valid_reference, rowvar=False)

    transfer = matrix_sqrt(cov_reference)
    sqrt_cov_content = matrix_sqrt(cov_content)

    if np.linalg.det(sqrt_cov_content) == 0:
        # Singular matrix: modify it by an arbitrary value before calculating the inverse matrix
        sqrt_cov_content += (
            np.identity(sqrt_cov_content.shape[-1], sqrt_cov_content.dtype) / 255.0
        )
    sqrt_cov_content_inv = np.linalg.inv(sqrt_cov_content)

    transfer = transfer.dot(sqrt_cov_content_inv)
    transfer = transfer.dot((content - mu_content).T).T
    transfer = transfer + mu_reference

    # Restore image dimensions.
    transfer = transfer.reshape(img.shape).clip(0, 1)

    return transfer
