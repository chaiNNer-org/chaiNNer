import io
from typing import Tuple
import cv2
import numpy as np

from abc import ABC, abstractmethod


class ClipboardBase(ABC):
    @staticmethod
    def prepare_image(image_array: np.ndarray) -> Tuple[bytes, np.ndarray]:
        image_array = (np.clip(image_array, 0, 1) * 255).round().astype("uint8")

        _, im_buff_arr = cv2.imencode(".png", image_array)

        return im_buff_arr.tobytes(), image_array

    @abstractmethod
    def copy_image(self, image_bytes: bytes, image_array: np.ndarray) -> None:
        return NotImplemented
