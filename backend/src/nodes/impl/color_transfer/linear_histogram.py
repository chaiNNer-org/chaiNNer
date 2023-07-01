from __future__ import annotations

import numpy as np

from nodes.impl.image_utils import to_uint8

__author__ = "Daniel Steinberg"
__copyright__ = "Copyright 2022, Daniel Steinberg"
__credits__ = ["Daniel Steinberg"]
__license__ = "MIT"
__version__ = "1.0.0"
__maintainer__ = "Daniel Steinberg"
__link__ = "https://github.com/dstein64/colortrans"


def matrix_sqrt(X):
    eig_val, eig_vec = np.linalg.eig(X)
    return eig_vec.dot(np.diag(np.sqrt(eig_val))).dot(eig_vec.T)


def linear_histogram_transfer(
    img: np.ndarray,
    ref_img: np.ndarray,
) -> np.ndarray:
    """
    Transfers the color distribution from the source to the target image
    using the Linear Histogram Matching..

    This implementation is based on to the Hertzmann, Aaron. "Algorithms
    for Rendering in Artistic Styles." Ph.D., New York University, 2001.
    """

    shape = img.shape

    # Convert HxWxC image to a (H*W)xC matrix.
    content = to_uint8(img).reshape(-1, shape[-1])
    reference = to_uint8(ref_img).reshape(-1, shape[-1])

    mu_content = np.mean(content, axis=0)
    mu_reference = np.mean(reference, axis=0)

    cov_content = np.cov(content, rowvar=False)
    cov_reference = np.cov(reference, rowvar=False)

    transfer = matrix_sqrt(cov_reference)
    transfer = transfer.dot(np.linalg.inv(matrix_sqrt(cov_content)))
    transfer = transfer.dot((content - mu_content).T).T
    transfer = transfer + mu_reference

    # Restore image dimensions.
    transfer = transfer.reshape(img.shape).clip(0, 255).round() / 255.0

    return transfer
