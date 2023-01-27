import numpy as np

from ..image_utils import as_3d


def distinct_colors(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        image = as_3d(image)
    return np.unique(image.reshape((-1, image.shape[2])), axis=0).reshape((1, -1, image.shape[2]))
