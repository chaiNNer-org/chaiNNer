import warnings

import numpy as np


def sanity_check_image(image):
    """Performs a sanity check for input images. Image values should be in the
    range [0, 1], the `dtype` should be `np.float32` or `np.float64` and the
    image shape should be `(?, ?, 3)`.
    Parameters
    ----------
    image: numpy.ndarray
        Image with shape :math:`h \\times w \\times 3`
    Example
    -------
    >>> import numpy as np
    >>> from pymatting import check_image
    >>> image = (np.random.randn(64, 64, 2) * 255).astype(np.int32)
    >>> sanity_check_image(image)
    __main__:1: UserWarning: Expected RGB image of shape (?, ?, 3), but image.shape is (64, 64, 2).
    __main__:1: UserWarning: Image values should be in [0, 1], but image.min() is -933.
    __main__:1: UserWarning: Image values should be in [0, 1], but image.max() is 999.
    __main__:1: UserWarning: Unexpected image.dtype int32. Are you sure that you do not want to use np.float32 or np.float64 instead?
    """

    if len(image.shape) != 3 or image.shape[2] != 3:
        warnings.warn(
            "Expected RGB image of shape (?, ?, 3), but image.shape is %s."
            % str(image.shape),
            stacklevel=3,
        )

    min_value = image.min()
    max_value = image.max()

    if min_value < 0.0:
        warnings.warn(
            "Image values should be in [0, 1], but image.min() is %s." % min_value,
            stacklevel=3,
        )

    if max_value > 1.0:
        warnings.warn(
            "Image values should be in [0, 1], but image.max() is %s." % max_value,
            stacklevel=3,
        )

    if image.dtype not in [np.float32, np.float64]:
        warnings.warn(
            "Unexpected image.dtype %s. Are you sure that you do not want to use np.float32 or np.float64 instead?"
            % image.dtype,
            stacklevel=3,
        )


def stack_images(*images):
    """This function stacks images along the third axis.
    This is useful for combining e.g. rgb color channels or color and alpha channels.
    Parameters
    ----------
    *images: numpy.ndarray
        Images to be stacked.
    Returns
    -------
    image: numpy.ndarray
        Stacked images as numpy.ndarray
    Example
    -------
    >>> from pymatting.util.util import stack_images
    >>> import numpy as np
    >>> I = stack_images(np.random.rand(4,5,3), np.random.rand(4,5,3))
    >>> I.shape
    (4, 5, 6)
    """
    images = [
        (image if len(image.shape) == 3 else image[:, :, np.newaxis])
        for image in images
    ]
    return np.concatenate(images, axis=2)


def trimap_split(trimap, flatten=True, bg_threshold=0.1, fg_threshold=0.9):
    """This function splits the trimap into foreground pixels, background pixels, and unknown pixels.
    Foreground pixels are pixels where the trimap has values larger than or equal to `fg_threshold` (default: 0.9).
    Background pixels are pixels where the trimap has values smaller than or equal to `bg_threshold` (default: 0.1).
    Pixels with other values are assumed to be unknown.
    Parameters
    ----------
    trimap: numpy.ndarray
        Trimap with shape :math:`h \\times w`
    flatten: bool
        If true np.flatten is called on the trimap
    Returns
    -------
    is_fg: numpy.ndarray
        Boolean array indicating which pixel belongs to the foreground
    is_bg: numpy.ndarray
        Boolean array indicating which pixel belongs to the background
    is_known: numpy.ndarray
        Boolean array indicating which pixel is known
    is_unknown: numpy.ndarray
        Boolean array indicating which pixel is unknown
    bg_threshold: float
        Pixels with smaller trimap values will be considered background.
    fg_threshold: float
        Pixels with larger trimap values will be considered foreground.
    Example
    -------
    >>> import numpy as np
    >>> from pymatting import *
    >>> trimap = np.array([[1,0],[0.5,0.2]])
    >>> is_fg, is_bg, is_known, is_unknown = trimap_split(trimap)
    >>> is_fg
    array([ True, False, False, False])
    >>> is_bg
    array([False,  True, False, False])
    >>> is_known
    array([ True,  True, False, False])
    >>> is_unknown
    array([False, False,  True,  True])
    """
    if flatten:
        trimap = trimap.flatten()

    min_value = trimap.min()
    max_value = trimap.max()

    if min_value < 0.0:
        warnings.warn(
            "Trimap values should be in [0, 1], but trimap.min() is %s." % min_value,
            stacklevel=3,
        )

    if max_value > 1.0:
        warnings.warn(
            "Trimap values should be in [0, 1], but trimap.max() is %s." % min_value,
            stacklevel=3,
        )

    if trimap.dtype not in [np.float32, np.float64]:
        warnings.warn(
            "Unexpected trimap.dtype %s. Are you sure that you do not want to use np.float32 or np.float64 instead?"
            % trimap.dtype,
            stacklevel=3,
        )

    is_fg = trimap >= fg_threshold
    is_bg = trimap <= bg_threshold

    if is_bg.sum() == 0:
        raise ValueError(
            "Trimap did not contain background values (values <= %f)" % bg_threshold
        )

    if is_fg.sum() == 0:
        raise ValueError(
            "Trimap did not contain foreground values (values >= %f)" % fg_threshold
        )

    is_known = is_fg | is_bg
    is_unknown = ~is_known

    return is_fg, is_bg, is_known, is_unknown
