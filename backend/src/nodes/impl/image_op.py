from typing import Callable

import numpy as np
from typing_extensions import Concatenate, ParamSpec

ImageOp = Callable[[np.ndarray], np.ndarray]
"""
An image processing operation that takes an image and produces a new image.

The given image is guaranteed to *not* be modified.
"""


def clipped(op: ImageOp) -> ImageOp:
    """
    Ensures that all values in the returned image are between 0 and 1.
    """
    return lambda i: np.clip(op(i), 0, 1)


P = ParamSpec("P")


def to_op(fn: Callable[Concatenate[np.ndarray, P], np.ndarray]) -> Callable[P, ImageOp]:
    """
    Applies a form of currying to convert the given function into a constructor for an image operation.

    Example: Simple resize method could be defined as follows: `resize(np.ndarray, Size2D) -> np.ndarray`.
    It takes an image and its new size and returns the resized image.
    If we want to convert it to an image operation, we have to create a function with the following signature: `resize_op(Size2D) -> ImageOp`.
    The implementation of this function would be rather simple, it would simply take all arguments of `resize` except for the image like this:
    ```py
    def resize_op(size: Size2D) -> ImageOp:
        return lambda img: resize(img, size)
    ```
    `to_op` does exactly this transformation, but for any number of arguments.

    Note: This only works if the input image is the first argument of the given function.
    """

    def p(*args: P.args, **kwargs: P.kwargs) -> ImageOp:
        return lambda i: fn(i, *args, **kwargs)

    return p
