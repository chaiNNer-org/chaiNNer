from abc import ABC, abstractmethod
from typing import Tuple

import cv2
import numpy as np

from ..image_utils import to_uint8


class ClipboardBase(ABC):
    @staticmethod
    def prepare_image(image_array: np.ndarray) -> Tuple[bytes, np.ndarray]:
        image_array = to_uint8(image_array)

        _, im_buff_arr = cv2.imencode(".png", image_array)

        return im_buff_arr.tobytes(), image_array

    @abstractmethod
    def copy_image(self, image_bytes: bytes, image_array: np.ndarray) -> None:
        return NotImplemented

    @abstractmethod
    def copy_text(self, text: str) -> None:
        return NotImplemented
