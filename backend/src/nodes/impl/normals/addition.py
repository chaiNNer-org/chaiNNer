import math
from enum import Enum

import numpy as np

from .util import XYZ, normalize_normals


class AdditionMethod(Enum):
    PARTIAL_DERIVATIVES = 0
    """
    The addition works by converting the normals into 2D slopes and then adding
    the slopes. The sum of the slopes is then converted back into normals.

    When adding 2 normal maps, the normals themselves are not added;
    Instead, the heightmaps that those normals represent are added.
    Conceptually, this entails converting the normals into slopes
    (the derivatives of the heightmap), integrating the slopes to get
    the heightmaps, adding the heightmaps, then performing the reverse
    on the added heightmaps. Practically, this is unnecessary, as adding
    the slopes together is equivalent to adding the heightmaps.
    """
    ANGLES = 1
    """
    The addition works by converting the normals into 2 angles, one angle the
    X axis and one along the Y axis. Those 2 angles are then added together.

    Since this might create angles outside the range of -90° to 90°,
    the resulting angles are clamped to this range.
    """


def __partial_derivatives(n1: XYZ, n2: XYZ, f1: float, f2: float) -> XYZ:
    x1, y1, z1 = n1
    x2, y2, z2 = n2

    # Slopes aren't defined for z=0, so set to near-zero decimal
    z1 = np.maximum(z1, 0.001, out=z1)
    z2 = np.maximum(z2, 0.001, out=z2)

    # This works as follows:
    # 1. Use the normals n,m to calculate 3D planes (the slopes) centered at origin p_n,p_m.
    # 2. Calculate the Z values of those planes at a_xy=(1,0) and b_xy=(0,1).
    # 3. Add the Z values to together (weighted using their strength):
    #    a_z = p_n[a_xy] * n_strength + p_m[a_xy] * m_strength, same for b_xy.
    # 4. Define a=(1,0,a_z), b=(0,1,b_z).
    # 5. The final normal will be normalize(cross(a,b)).
    # This works out as:

    n_f = f1 / z1
    m_f = f2 / z2

    x = x1 * n_f + x2 * m_f
    y = y1 * n_f + y2 * m_f

    l_r = 1 / np.sqrt(np.square(x) + np.square(y) + 1)
    x *= l_r
    y *= l_r
    z = l_r

    return x, y, z


def __clamp_angles(angles: np.ndarray) -> np.ndarray:
    return np.clip(angles, -math.pi / 2, math.pi / 2)


def __angles(n1: XYZ, n2: XYZ, f1: float, f2: float) -> XYZ:
    x1, y1, _ = n1
    x2, y2, _ = n2

    return normalize_normals(
        np.sin(__clamp_angles(np.arcsin(x1) * f1 + np.arcsin(x2) * f2)),
        np.sin(__clamp_angles(np.arcsin(y1) * f1 + np.arcsin(y2) * f2)),
    )


def add_normals(
    method: AdditionMethod,
    n1: np.ndarray,
    n2: np.ndarray,
    f1: float = 1,
    f2: float = 1,
) -> XYZ:
    # Convert BGR to XY
    x1 = n1[:, :, 2] * 2 - 1
    y1 = n1[:, :, 1] * 2 - 1
    x2 = n2[:, :, 2] * 2 - 1
    y2 = n2[:, :, 1] * 2 - 1

    xyz1 = normalize_normals(x1, y1)
    xyz2 = normalize_normals(x2, y2)

    if method is AdditionMethod.PARTIAL_DERIVATIVES:
        return __partial_derivatives(xyz1, xyz2, f1, f2)
    elif method is AdditionMethod.ANGLES:
        return __angles(xyz1, xyz2, f1, f2)
    else:
        raise AssertionError(f"Invalid normal addition method {method}")
