import numpy as np

from .cf_laplacian import cf_laplacian
from .cg import cg
from .ichol import ichol
from .util import sanity_check_image, trimap_split


def estimate_alpha_cf(  # pylint: disable=dangerous-default-value
    image, trimap, preconditioner=None, laplacian_kwargs={}, cg_kwargs={}
):
    """
    Estimate alpha from an input image and an input trimap using Closed-Form Alpha Matting as proposed by :cite:`levin2007closed`.

    Parameters
    ----------
    image: numpy.ndarray
        Image with shape :math:`h \\times  w \\times d` for which the alpha matte should be estimated
    trimap: numpy.ndarray
        Trimap with shape :math:`h \\times  w` of the image
    preconditioner: function or scipy.sparse.linalg.LinearOperator
        Function or sparse matrix that applies the preconditioner to a vector (default: ichol)
    laplacian_kwargs: dictionary
        Arguments passed to the :code:`cf_laplacian` function
    cg_kwargs: dictionary
        Arguments passed to the :code:`cg` solver
    is_known: numpy.ndarray
        Binary mask of pixels for which to compute the laplacian matrix.
        Providing this parameter might improve performance if few pixels are unknown.

    Returns
    -------
    alpha: numpy.ndarray
        Estimated alpha matte

    Example
    -------
    >>> from pymatting import *
    >>> image = load_image("data/lemur/lemur.png", "RGB")
    >>> trimap = load_image("data/lemur/lemur_trimap.png", "GRAY")
    >>> alpha = estimate_alpha_cf(
    ...     image,
    ...     trimap,
    ...     laplacian_kwargs={"epsilon": 1e-6},
    ...     cg_kwargs={"maxiter":2000})
    """
    if preconditioner is None:
        preconditioner = ichol

    sanity_check_image(image)

    is_fg, _, is_known, is_unknown = trimap_split(trimap)

    L = cf_laplacian(image, **laplacian_kwargs, is_known=is_known)

    # Split Laplacian matrix L into
    #
    #     [L_U   R ]
    #     [R^T   L_K]
    #
    # and then solve L_U x_U = -R is_fg_K for x where K (is_known) corresponds to
    # fixed pixels and U (is_unknown) corresponds to unknown pixels. For reference, see
    # Grady, Leo, et al. "Random walks for interactive alpha-matting." Proceedings of VIIP. Vol. 2005. 2005.

    L_U = L[is_unknown, :][:, is_unknown]

    R = L[is_unknown, :][:, is_known]

    m = is_fg[is_known]

    x = trimap.copy().ravel()

    x[is_unknown] = cg(L_U, -R.dot(m), M=preconditioner(L_U), **cg_kwargs)

    alpha = np.clip(x, 0, 1).reshape(trimap.shape)

    return alpha
