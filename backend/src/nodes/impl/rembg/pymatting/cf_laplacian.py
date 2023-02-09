import numpy as np
import scipy.sparse
from numba import njit

from ....utils.utils import get_h_w_c


@njit(
    "void(f8[:, :, :], f8, i8, f8[:, :, :], i8[:], i8[:], b1[:, :])",
    cache=True,
    nogil=True,
)
def _cf_laplacian(image, epsilon, r, values, indices, indptr, is_known):
    h, w, d = image.shape
    assert d == 3
    size = 2 * r + 1
    window_area = size * size

    for yi in range(h):
        for xi in range(w):
            i = xi + yi * w
            k = i * (4 * r + 1) ** 2
            for yj in range(yi - 2 * r, yi + 2 * r + 1):
                for xj in range(xi - 2 * r, xi + 2 * r + 1):
                    j = xj + yj * w

                    if 0 <= xj < w and 0 <= yj < h:
                        indices[k] = j

                    k += 1

            indptr[i + 1] = k

    # Centered and normalized window colors
    c = np.zeros((2 * r + 1, 2 * r + 1, 3))

    # For each pixel of image
    for y in range(r, h - r):
        for x in range(r, w - r):
            if np.all(is_known[y - r : y + r + 1, x - r : x + r + 1]):
                continue

            # For each color channel
            for dc in range(3):
                # Calculate sum of color channel in window
                s = 0.0
                for dy in range(size):
                    for dx in range(size):
                        s += image[y + dy - r, x + dx - r, dc]

                # Calculate centered window color
                for dy in range(2 * r + 1):
                    for dx in range(2 * r + 1):
                        c[dy, dx, dc] = (
                            image[y + dy - r, x + dx - r, dc] - s / window_area
                        )

            # Calculate covariance matrix over color channels with epsilon regularization
            a00 = epsilon
            a01 = 0.0
            a02 = 0.0
            a11 = epsilon
            a12 = 0.0
            a22 = epsilon

            for dy in range(size):
                for dx in range(size):
                    a00 += c[dy, dx, 0] * c[dy, dx, 0]
                    a01 += c[dy, dx, 0] * c[dy, dx, 1]
                    a02 += c[dy, dx, 0] * c[dy, dx, 2]
                    a11 += c[dy, dx, 1] * c[dy, dx, 1]
                    a12 += c[dy, dx, 1] * c[dy, dx, 2]
                    a22 += c[dy, dx, 2] * c[dy, dx, 2]

            a00 /= window_area
            a01 /= window_area
            a02 /= window_area
            a11 /= window_area
            a12 /= window_area
            a22 /= window_area

            det = (
                a00 * a12 * a12
                + a01 * a01 * a22
                + a02 * a02 * a11
                - a00 * a11 * a22
                - 2 * a01 * a02 * a12
            )

            inv_det = 1.0 / det

            # Calculate inverse covariance matrix
            m00 = (a12 * a12 - a11 * a22) * inv_det
            m01 = (a01 * a22 - a02 * a12) * inv_det
            m02 = (a02 * a11 - a01 * a12) * inv_det
            m11 = (a02 * a02 - a00 * a22) * inv_det
            m12 = (a00 * a12 - a01 * a02) * inv_det
            m22 = (a01 * a01 - a00 * a11) * inv_det

            # For each pair ((xi, yi), (xj, yj)) in a (2 r + 1)x(2 r + 1) window
            for dyi in range(2 * r + 1):
                for dxi in range(2 * r + 1):
                    s = c[dyi, dxi, 0]
                    t = c[dyi, dxi, 1]
                    u = c[dyi, dxi, 2]

                    c0 = m00 * s + m01 * t + m02 * u
                    c1 = m01 * s + m11 * t + m12 * u
                    c2 = m02 * s + m12 * t + m22 * u

                    for dyj in range(2 * r + 1):
                        for dxj in range(2 * r + 1):
                            xi = x + dxi - r
                            yi = y + dyi - r
                            xj = x + dxj - r
                            yj = y + dyj - r

                            i = xi + yi * w
                            j = xj + yj * w

                            # Calculate contribution of pixel pair to L_ij
                            temp = (
                                c0 * c[dyj, dxj, 0]
                                + c1 * c[dyj, dxj, 1]
                                + c2 * c[dyj, dxj, 2]
                            )

                            value = (1.0 if (i == j) else 0.0) - (
                                1 + temp
                            ) / window_area

                            dx = xj - xi + 2 * r
                            dy = yj - yi + 2 * r

                            values[i, dy, dx] += value


def cf_laplacian(image, epsilon=1e-7, radius=1, is_known=None):
    """
    This function implements the alpha estimator for closed-form alpha matting as proposed by :cite:`levin2007closed`.
    Parameters
    ------------
    image: numpy.ndarray
       Image with shape :math:`h\\times w \\times 3`
    epsilon: float
       Regularization strength, defaults to :math:`10^{-7}`. Strong regularization improves convergence but results in smoother alpha mattes.
    radius: int
       Radius of local window size, defaults to :math:`1`, i.e. only adjacent pixels are considered.
       The size of the local window is given as :math:`(2 r + 1)^2`, where :math:`r` denotes         the radius. A larger radius might lead to violated color line constraints, but also
       favors further propagation of information within the image.
    is_known: numpy.ndarray
        Binary mask of pixels for which to compute the laplacian matrix.
        Laplacian entries for known pixels will have undefined values.
    Returns
    -------
    L: scipy.sparse.spmatrix
        Matting Laplacian
    """
    h, w, _ = get_h_w_c(image)
    n = h * w

    if is_known is None:
        is_known = np.zeros((h, w), dtype=np.bool8)

    is_known = is_known.reshape(h, w)

    # Data for matting laplacian in csr format
    indptr = np.zeros(n + 1, dtype=np.int64)
    indices = np.zeros(n * (4 * radius + 1) ** 2, dtype=np.int64)
    values = np.zeros((n, 4 * radius + 1, 4 * radius + 1), dtype=np.float64)

    _cf_laplacian(image, epsilon, radius, values, indices, indptr, is_known)

    L = scipy.sparse.csr_matrix((values.ravel(), indices, indptr), (n, n))

    return L
