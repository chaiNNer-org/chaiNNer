import numpy as np
import scipy.sparse
from numba import njit


@njit(
    "i8(i8, f8[:], i8[:], i8[:], f8[:], i8[:], i8[:], f8, f8, i8, f8, b1)",
    cache=True,
    nogil=True,
)
def _ichol(
    n,
    Av,
    Ar,
    Ap,
    Lv,
    Lr,
    Lp,
    discard_threshold,
    shift,
    max_nnz,
    relative_discard_threshold,
    diag_keep_discarded,
):
    """
    :cite:`jones1995improved` might be slightly interesting for the general idea
    to use linked list to keep track of the sparse matrix values. But instead of
    pointers, we have to use indices here, since this is Python and not C.
    """
    nnz = 0
    c_n = 0
    s = np.zeros(n, np.int64)  # Next non-zero row index i in column j of L
    t = np.zeros(n, np.int64)  # First subdiagonal index i in column j of A
    l = (
        np.zeros(n, np.int64) - 1
    )  # Linked list of non-zero columns in row k of L; type: ignore
    a = np.zeros(n, np.float64)  # Values of column j
    r = np.zeros(n, np.float64)  # r[j] = sum(abs(A[j:, j])) for relative threshold
    b = np.zeros(
        n, np.bool_
    )  # b[i] indicates if the i-th element of column j is non-zero
    c = np.empty(n, np.int64)  # Row indices of non-zero elements in column j
    d = np.full(n, shift, np.float64)  # Diagonal elements of A
    for j in range(n):
        for idx in range(Ap[j], Ap[j + 1]):
            i = Ar[idx]
            if i == j:
                d[j] += Av[idx]
                t[j] = idx + 1
            if i >= j:
                r[j] += abs(Av[idx])
    for j in range(n):  # For each column j
        for idx in range(t[j], Ap[j + 1]):  # For each L_ij
            i = Ar[idx]
            L_ij = Av[idx]
            if L_ij != 0.0 and i > j:
                a[i] += L_ij  # Assign non-zero value to L_ij in sparse column
                if not b[i]:
                    b[i] = True  # Mark it as non-zero
                    c[c_n] = i  # Remember index for later deletion
                    c_n += 1
        k = l[j]  # Find index k of column with non-zero element in row j
        while k != -1:  # For each column of that type
            k0 = s[k]  # Start index of non-zero elements in column k
            k1 = Lp[k + 1]  # End index
            k2 = l[k]  # Remember next column index before it is overwritten
            L_jk = Lv[k0]  # Value of non-zero element at start of column
            k0 += 1  # Advance to next non-zero element in column
            if k0 < k1:  # If there is a next non-zero element
                s[k] = k0  # Advance start index in column k to next non-zero element
                i = Lr[k0]  # Row index of next non-zero element in column k
                l[k] = l[i]  # Remember old list i index in list k
                l[i] = k  # Insert index of non-zero element into list i
                for idx in range(k0, k1):  # For each non-zero L_ik in column k
                    i = Lr[idx]
                    L_ik = Lv[idx]
                    a[i] -= L_ik * L_jk  # Update element L_ij in sparse column
                    if not b[i]:  # Check if sparse column element was zero
                        b[i] = True  # Mark as non-zero in sparse column
                        c[c_n] = i  # Remember index for later deletion
                        c_n += 1
            k = k2  # Advance to next column k
        if d[j] <= 0.0:
            return -1
        if nnz + 1 + c_n > max_nnz:
            return -2
        d[j] = np.sqrt(d[j])  # Update diagonal element L_ii
        Lv[nnz] = d[j]  # Add diagonal element L_ii to L
        Lr[nnz] = j  # Add row index of L_ii to L
        nnz += 1
        s[j] = nnz  # Set first non-zero index of column j
        for i in np.sort(
            c[:c_n]
        ):  # Sort row indices of column j for correct insertion order into L
            L_ij = a[i] / d[j]  # Get non-zero element from sparse column j
            if diag_keep_discarded:
                d[i] -= L_ij * L_ij  # Update diagonal element L_ii
            rel = (
                relative_discard_threshold * r[j]
            )  # Relative discard threshold (before div)
            if (
                abs(L_ij) > discard_threshold and abs(a[i]) > rel
            ):  # If element is sufficiently non-zero
                if not diag_keep_discarded:
                    d[i] -= L_ij * L_ij  # Update diagonal element L_ii
                Lv[nnz] = L_ij  # Add element L_ij to L
                Lr[nnz] = i  # Add row index of L_ij
                nnz += 1
            a[i] = 0.0  # Set element i in column j to zero
            b[i] = False  # Mark element as zero
        c_n = 0  # Discard row indices of non-zero elements in column j.
        Lp[j + 1] = nnz  # Update count of non-zero elements up to column j
        if Lp[j] + 1 < Lp[j + 1]:  # If column j has a non-zero element below diagonal
            i = Lr[Lp[j] + 1]  # Row index of first off-diagonal non-zero element
            l[j] = l[i]  # Remember old list i index in list j
            l[i] = j  # Insert index of non-zero element into list i
    return nnz


@njit("void(f8[:], i8[:], i8[:], f8[:], i8)", cache=True, nogil=True)
def _backsub_L_csc_inplace(data, indices, indptr, x, n):
    for j in range(n):
        k = indptr[j]
        L_jj = data[k]
        temp = x[j] / L_jj

        x[j] = temp

        for k in range(indptr[j] + 1, indptr[j + 1]):
            i = indices[k]
            L_ij = data[k]

            x[i] -= L_ij * temp


@njit("void(f8[:], i8[:], i8[:], f8[:], i8)", cache=True, nogil=True)
def _backsub_LT_csc_inplace(data, indices, indptr, x, n):
    for i in range(n - 1, -1, -1):
        s = x[i]

        for k in range(indptr[i] + 1, indptr[i + 1]):
            j = indices[k]
            L_ji = data[k]
            s -= L_ji * x[j]

        k = indptr[i]
        L_ii = data[k]

        x[i] = s / L_ii


class CholeskyDecomposition:
    """Cholesky Decomposition

    Calling this object applies the preconditioner to a vector by forward and back substitution.

    Parameters
    ----------
    Ltuple: tuple of numpy.ndarrays
        Tuple of array describing values, row indices and row pointers for Cholesky factor in the compressed sparse column format (csc)
    """

    def __init__(self, Ltuple):
        self.Ltuple = Ltuple

    @property
    def L(self):
        """Returns the Cholesky factor

        Returns
        -------
        L: scipy.sparse.csc_matrix
            Cholesky factor
        """
        _, _, Lp = self.Ltuple
        n = len(Lp) - 1
        return scipy.sparse.csc_matrix(self.Ltuple, (n, n))

    def __call__(self, b):
        Lv, Lr, Lp = self.Ltuple
        n = len(b)
        x = b.copy()
        _backsub_L_csc_inplace(Lv, Lr, Lp, x, n)
        _backsub_LT_csc_inplace(Lv, Lr, Lp, x, n)
        return x


def ichol(  # pylint: disable=dangerous-default-value
    A,
    discard_threshold=1e-4,
    shifts=[0.0, 1e-4, 1e-3, 1e-2, 0.1, 0.5, 1.0, 10.0, 100, 1e3, 1e4, 1e5],
    max_nnz=int(4e9 / 16),
    relative_discard_threshold=0.0,
    diag_keep_discarded=True,
):
    """Implements the thresholded incomplete Cholesky decomposition

    Parameters
    ----------
    A: scipy.sparse.csc_matrix
        Matrix for which the preconditioner should be calculated
    discard_threshold: float
        Values having an absolute value smaller than this threshold will be discarded while calculating the Cholesky decompositions
    shifts: array of floats
        Values to try for regularizing the matrix of interest in case it is not positive definite after discarding the small values
    max_nnz: int
        Maximum number of non-zero entries in the Cholesky decomposition. Defaults to 250 million, which should usually be around 4 GB.
    relative_discard_threshold: float
        Values with an absolute value of less than :code:`relative_discard_threshold * sum(abs(A[j:, j]))` will be discarded.
        A dense ichol implementation with relative threshold would look like this::

            L = np.tril(A)
            for j in range(n):
                col = L[j:, j]
                col -= np.sum(L[j, :j] * L[j:, :j], axis=1)
                discard_mask = abs(col[1:]) < relative_discard_threshold * np.sum(np.abs(A[j:, j]))
                col[1:][discard_mask] = 0
                col[0] **= 0.5
                col[1:] /= col[0]

    diag_keep_discarded: bool
        Whether to update the diagonal with the discarded values. Usually better if :code:`True`.

    Returns
    -------
    chol: CholeskyDecomposition
        Preconditioner or solver object.

    Raises
    ------
    ValueError
        If inappropriate parameter values were passed

    Example
    -------
    >>> from pymatting import *
    >>> import numpy as np
    >>> from scipy.sparse import csc_matrix
    >>> A = np.array([[2.0, 3.0], [3.0, 5.0]])
    >>> cholesky_decomposition = ichol(csc_matrix(A))
    >>> cholesky_decomposition(np.array([1.0, 2.0]))
    array([-1.,  1.])
    """

    if isinstance(A, scipy.sparse.csr_matrix):
        A = A.T

    if not isinstance(A, scipy.sparse.csc_matrix):
        raise ValueError("Matrix A must be a scipy.sparse.csc_matrix")

    if not A.has_canonical_format:
        A.sum_duplicates()

    m, n = A.shape

    assert m == n

    Lv = np.empty(max_nnz, dtype=np.float64)  # Values of non-zero elements of L
    Lr = np.empty(max_nnz, dtype=np.int64)  # Row indices of non-zero elements of L
    Lp = np.zeros(
        n + 1, dtype=np.int64
    )  # Start(Lp[i]) and end(Lp[i+1]) index of L[:, i] in Lv

    nnz = -3
    for shift in shifts:
        nnz = _ichol(
            n,
            A.data,
            A.indices.astype(np.int64),
            A.indptr.astype(np.int64),
            Lv,
            Lr,
            Lp,
            discard_threshold,
            shift,
            max_nnz,
            relative_discard_threshold,
            diag_keep_discarded,
        )

        if nnz >= 0:
            break

        if nnz == -1:
            print("PERFORMANCE WARNING:")
            print(
                "Thresholded incomplete Cholesky decomposition failed due to insufficient positive-definiteness of matrix A with parameters:"
            )
            print("    discard_threshold = %e" % discard_threshold)
            print("    shift = %e" % shift)
            print("Try decreasing discard_threshold or start with a larger shift")
            print("")

        if nnz == -2:
            raise ValueError(
                "Thresholded incomplete Cholesky decomposition failed because more than max_nnz non-zero elements were created. Try increasing max_nnz or discard_threshold."
            )

    if nnz < 0:
        raise ValueError(
            "Thresholded incomplete Cholesky decomposition failed due to insufficient positive-definiteness of matrix A and diagonal shifts did not help."
        )

    Lv = Lv[:nnz]
    Lr = Lr[:nnz]

    return CholeskyDecomposition((Lv, Lr, Lp))
