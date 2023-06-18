from typing import List, Optional

import cv2
import numpy as np

from ..image_utils import as_3d
from .common import as_dtype, as_float32


def nearest_uniform_color(value: np.ndarray, num_colors: int) -> np.ndarray:
    return np.floor(value * (num_colors - 1) + 0.5) / (num_colors - 1)


def batch_nearest_uniform_color(image: np.ndarray, num_colors: int) -> np.ndarray:
    return as_dtype(
        np.floor(as_float32(image) * (num_colors - 1) + 0.5) / (num_colors - 1),
        image.dtype,
    )


def nearest_palette_color(
    pixel: np.ndarray,
    palette: np.ndarray,
    cache: Optional[List[cv2.ml.KNearest]],
) -> np.ndarray:
    palette = as_3d(palette)

    if pixel.shape[0] != palette.shape[2]:
        raise RuntimeError(
            "Trying to compare color distance between different numbers of channels."
        )

    if cache is not None:
        if not cache:
            # Initialize a k-d tree for this palette
            kdtree = cv2.ml.KNearest_create()
            kdtree.setAlgorithmType(cv2.ml.KNEAREST_KDTREE)
            kdtree.train(
                palette.reshape((-1, palette.shape[2])),
                cv2.ml.ROW_SAMPLE,
                np.arange(palette.shape[1]),
            )
            cache.append(kdtree)
        else:
            kdtree = cache[0]

        _, results, _, _ = kdtree.findNearest(pixel.reshape((1, -1)), 1)
        idx = results[0][0]
        return palette[0, idx, :]

    else:
        closest = None
        closest_distance = None

        for idx in range(palette.shape[1]):
            color = palette[0, idx, :]
            distance = np.power(pixel - color, 2).mean()  # type: ignore
            if closest is None or distance < closest_distance:
                closest = color
                closest_distance = distance

        return closest  # type: ignore


def batch_nearest_palette_color(
    image: np.ndarray,
    palette: np.ndarray,
) -> np.ndarray:
    image = as_3d(image)
    palette = as_3d(palette)

    if image.shape[2] != palette.shape[2]:
        raise RuntimeError(
            "Trying to compare color distance between different numbers of channels."
        )

    output = np.zeros(
        (image.shape[0], image.shape[1], palette.shape[2]), dtype=np.float32
    )
    low_water_mark = np.zeros((image.shape[0], image.shape[1]), dtype=np.float32)

    for idx in range(palette.shape[1]):
        color = palette[0, idx, :]
        distance = np.power(image[:, :] - color, 2).mean(axis=2)  # type: ignore
        if idx == 0:
            output[:, :] = color
            low_water_mark[:, :] = distance
        else:
            # boolean mask indicating pixels that are closer to this color than their current assignment
            closest_mask = distance < low_water_mark

            output[closest_mask] = color
            distance[closest_mask] = distance[closest_mask]

    return output
