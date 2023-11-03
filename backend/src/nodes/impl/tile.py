import math
from enum import Enum

import cv2
import numpy as np

from ..utils.utils import get_h_w_c


class TileMode(Enum):
    TILE = 0
    MIRROR = 1


def tile_image(img: np.ndarray, width: int, height: int, mode: TileMode) -> np.ndarray:
    if mode == TileMode.TILE:
        # do nothing
        pass
    elif mode == TileMode.MIRROR:
        # flip the image to create a mirrored tile
        flip_x: np.ndarray = cv2.flip(img, 0)
        flip_y: np.ndarray = cv2.flip(img, 1)
        flip_xy: np.ndarray = cv2.flip(img, -1)

        img = cv2.vconcat(
            [
                cv2.hconcat([img, flip_y]),  # type: ignore
                cv2.hconcat([flip_x, flip_xy]),  # type: ignore
            ]
        )
    else:
        raise AssertionError(f"Invalid tile mode {mode}")

    h, w, _ = get_h_w_c(img)
    tile_w = math.ceil(width / w)
    tile_h = math.ceil(height / h)
    img = np.tile(img, (tile_h, tile_w) if img.ndim == 2 else (tile_h, tile_w, 1))

    # crop to make sure the dimensions are correct
    return img[:height, :width]
