from enum import Enum
from typing import Union

import numpy as np


class HilbertCurveOrientation(Enum):
    A = 0  # clockwise cup facing down
    B = 1  # anticlockwise cup facing right
    C = 2  # clockwise cup facing up
    D = 3  # anticlockwise cup facing left


class HilbertCurve:
    def __init__(
        self,
        n: int,
        orientation: HilbertCurveOrientation = HilbertCurveOrientation.A,
        origin: Union[np.ndarray, None] = None,
    ):
        self.n = n
        self.orientation = orientation
        self.origin = np.array([0, 0]) if origin is None else origin
        assert self.origin.shape == (2,)

    def __iter__(self):
        """
        Iterate over the x,y coordinates of a hilbert curve covering an n by n grid.
        """
        if self.n == 1:
            yield self.origin
            return
        half_n = self.n // 2
        if self.orientation == HilbertCurveOrientation.A:
            # A -> A
            # ^    v
            # D    B
            yield from HilbertCurve(
                n=half_n, orientation=HilbertCurveOrientation.D, origin=self.origin
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.A,
                origin=self.origin + np.array([0, half_n]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.A,
                origin=self.origin + np.array([half_n, half_n]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.B,
                origin=self.origin + np.array([half_n, 0]),
            )
        elif self.orientation == HilbertCurveOrientation.B:
            # B <- C
            # v
            # B -> A
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.C,
                origin=self.origin + np.array([half_n, half_n]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.B,
                origin=self.origin + np.array([0, half_n]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.B,
                origin=self.origin + np.array([0, 0]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.A,
                origin=self.origin + np.array([half_n, 0]),
            )
        elif self.orientation == HilbertCurveOrientation.C:
            # D    B
            # ^    v
            # C <- C
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.B,
                origin=self.origin + np.array([half_n, half_n]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.C,
                origin=self.origin + np.array([half_n, 0]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.C,
                origin=self.origin + np.array([0, 0]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.D,
                origin=self.origin + np.array([0, half_n]),
            )
        elif self.orientation == HilbertCurveOrientation.D:
            # C <- D
            #      ^
            # A -> D
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.A,
                origin=self.origin + np.array([0, 0]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.D,
                origin=self.origin + np.array([half_n, 0]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.D,
                origin=self.origin + np.array([half_n, half_n]),
            )
            yield from HilbertCurve(
                n=half_n,
                orientation=HilbertCurveOrientation.C,
                origin=self.origin + np.array([0, half_n]),
            )
