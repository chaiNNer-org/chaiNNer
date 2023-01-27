import numpy as np
import cv2

from .color_distance import ColorDistanceFunction
from .common import dtype_to_float
from ..image_utils import as_3d


def distinct_colors(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        image = as_3d(image)
    return np.unique(image.reshape((-1, image.shape[2])), axis=0).reshape(
        (1, -1, image.shape[2])
    )


def kmeans_palette(image: np.ndarray, num_colors: int) -> np.ndarray:
    if image.ndim == 2:
        image = as_3d(image)
    flat_image = dtype_to_float(image.reshape((-1,image.shape[2])))

    max_iter = 10
    epsilon = 1.0
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, max_iter, epsilon)

    attempts = 10
    ret, label, center = cv2.kmeans(flat_image, num_colors, None, criteria, attempts, cv2.KMEANS_PP_CENTERS)

    return center.reshape((1, -1, image.shape[2]))