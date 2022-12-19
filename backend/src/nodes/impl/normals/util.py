from typing import Tuple
import numpy as np

XYZ = Tuple[np.ndarray, np.ndarray, np.ndarray]
"""
The normalized XYZ components of a normal map.
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
