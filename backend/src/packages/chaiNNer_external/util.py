from __future__ import annotations

import base64
import io

import cv2
import numpy as np
from PIL import Image

from nodes.impl.image_utils import normalize, to_uint8
from nodes.utils.utils import get_h_w_c


def nearest_valid_size(width: int, height: int):
    return (width // 8) * 8, (height // 8) * 8


def decode_base64_image(image_bytes: bytes | str) -> np.ndarray:
    image = Image.open(io.BytesIO(base64.b64decode(image_bytes)))
    image_nparray = np.array(image)
    _, _, c = get_h_w_c(image_nparray)
    if c == 3:
        image_nparray = cv2.cvtColor(image_nparray, cv2.COLOR_RGB2BGR)
    elif c == 4:
        image_nparray = cv2.cvtColor(image_nparray, cv2.COLOR_RGBA2BGRA)
    return normalize(image_nparray)


def encode_base64_image(image_nparray: np.ndarray) -> str:
    image_nparray = to_uint8(image_nparray)
    _, _, c = get_h_w_c(image_nparray)
    if c == 1:
        # PIL supports grayscale images just fine, so we don't need to do any conversion
        pass
    elif c == 3:
        image_nparray = cv2.cvtColor(image_nparray, cv2.COLOR_BGR2RGB)
    elif c == 4:
        image_nparray = cv2.cvtColor(image_nparray, cv2.COLOR_BGRA2RGBA)
    else:
        raise RuntimeError
    with io.BytesIO() as buffer:
        with Image.fromarray(image_nparray) as image:
            image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
