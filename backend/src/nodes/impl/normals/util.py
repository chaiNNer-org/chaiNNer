from typing import Tuple

import numpy as np

XYZ = Tuple[np.ndarray, np.ndarray, np.ndarray]
"""
The normalized XYZ components of a normal map. Z is guaranteed to be >= 0.
"""


def normalize_normals(x: np.ndarray, y: np.ndarray) -> XYZ:
    # The square of the length of X and Y
    l_sq = np.square(x) + np.square(y)

    # If the length of X and Y is >1, then make it 1
    l = np.sqrt(np.maximum(l_sq, 1))
    x /= l
    y /= l
    l_sq = np.minimum(l_sq, 1, out=l_sq)

    # Compute Z
    z = np.sqrt(1 - l_sq)

    return x, y, z


def gr_to_xyz(n: np.ndarray) -> XYZ:
    """
    Takes a BGR or BGRA image and converts it into XYZ normal components only by looking at the R and G channels.
    """

    x = n[:, :, 2] * 2 - 1
    y = n[:, :, 1] * 2 - 1

    return normalize_normals(x, y)


def xyz_to_bgr(xyz: XYZ) -> np.ndarray:
    """
    Converts the given XYZ components into an BGR image.
    """
    x, y, z = xyz

    r = (x + 1) * 0.5
    g = (y + 1) * 0.5
    b = z

    return np.dstack((b, g, r))


def octahedral_gr_to_xyz(n: np.ndarray) -> XYZ:
    """
    Takes a BGR or BGRA image of octahedral (RTX Remix) normals and converts it into XYZ normal components only by looking at the R and G channels.
    """
    r = n[:, :, 2] * 2 - 1
    g = n[:, :, 1] * 2 - 1

    x: np.ndarray = (r + g) / 2
    y: np.ndarray = r - x
    z: np.ndarray = 1 - np.abs(x) - np.abs(y)
    length = np.sqrt(np.square(x) + np.square(y) + np.square(z))
    x /= length
    y /= length
    z /= length  # type: ignore

    return x, y, z


def xyz_to_octahedral_bgr(xyz: XYZ) -> np.ndarray:
    """
    Converts the given XYZ components into an BGR image with normals using octahedral (RTX Remix) encoding.

    For more information about octahedral normals, see:
    https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/
    https://jcgt.org/published/0003/02/01/
    """
    x, y, z = xyz
    absolute = np.abs(x) + np.abs(y) + np.abs(z)
    x /= absolute
    y /= absolute

    # This is a trick used in RTX Remix to more efficiently encode normals.
    # Octahedral normals are defined for the whole range of values (so all possible unit vectors).
    # However, we know that we are working with hemispheric normal maps (z>=0)
    # and can use this knowledge to remap xy values to assume all possible values in [-1..1]x[-1..1].
    r = x + y
    g = x - y

    r = (r + 1) * 0.5
    g = (g + 1) * 0.5
    b = np.zeros(x.shape, dtype=np.float32)

    return np.dstack((b, g, r))
