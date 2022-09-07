import io
import os
import sys
import cv2
import numpy as np

from PIL import Image
from abc import ABC, abstractmethod

from nodes.utils.utils import get_h_w_c

class ClipboardBase(ABC):
    @staticmethod
    def prepare_image(img: np.ndarray):
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        _, _, c = get_h_w_c(img)
        if c == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        elif c == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA)

        data = Image.fromarray(img)

        imgBytes = io.BytesIO()
        data.save(imgBytes, format="png")

        return imgBytes.getvalue()

    @abstractmethod
    def copy_image(self, data: np.ndarray) -> None:
        return NotImplemented