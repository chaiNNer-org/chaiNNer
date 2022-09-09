import io
from typing import Tuple
import cv2
import numpy as np

from PIL import Image
from abc import ABC, abstractmethod

from nodes.utils.utils import get_h_w_c


class ClipboardBase(ABC):
    @staticmethod
    def prepare_image(imageArray: np.ndarray) -> Tuple[bytes, Image.Image]:
        imageArray = (np.clip(imageArray, 0, 1) * 255).round().astype("uint8")

        _, _, c = get_h_w_c(imageArray)
        if c == 3:
            imageArray = cv2.cvtColor(imageArray, cv2.COLOR_BGR2RGB)
        elif c == 4:
            imageArray = cv2.cvtColor(imageArray, cv2.COLOR_BGRA2RGBA)

        image = Image.fromarray(imageArray)

        imgBytes = io.BytesIO()
        image.save(imgBytes, format="png")

        return (imgBytes.getvalue(), image)

    @abstractmethod
    def copy_image(self, imageBytes: bytes, image: Image.Image) -> None:
        return NotImplemented
