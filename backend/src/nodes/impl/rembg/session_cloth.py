from __future__ import annotations

import numpy as np
from PIL import Image
from scipy.special import log_softmax

from nodes.impl.image_utils import normalize
from nodes.utils.utils import get_h_w_c

from .session_base import BaseSession

pallete1 = [
    0,
    0,
    0,
    255,
    255,
    255,
    0,
    0,
    0,
    0,
    0,
    0,
]

pallete2 = [
    0,
    0,
    0,
    0,
    0,
    0,
    255,
    255,
    255,
    0,
    0,
    0,
]

pallete3 = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    255,
    255,
    255,
]


class ClothSession(BaseSession):
    def predict(self, img: np.ndarray) -> list[np.ndarray]:
        h, w, _ = get_h_w_c(img)
        ort_outs = self.inner_session.run(None, self.normalize(img))

        pred = ort_outs
        pred = log_softmax(pred[0], 1)
        pred = np.argmax(pred, axis=1, keepdims=True)
        pred = np.squeeze(pred, 0)
        pred = np.squeeze(pred, 0)

        mask = Image.fromarray(pred.astype("uint8"), mode="L")
        mask = mask.resize((w, h), Image.LANCZOS)

        masks: list[np.ndarray] = []

        mask1 = mask.copy()
        mask1.putpalette(pallete1)
        mask1 = mask1.convert("RGB").convert("L")
        masks.append(normalize(np.array(mask1)))

        mask2 = mask.copy()
        mask2.putpalette(pallete2)
        mask2 = mask2.convert("RGB").convert("L")
        masks.append(normalize(np.array(mask2)))

        mask3 = mask.copy()
        mask3.putpalette(pallete3)
        mask3 = mask3.convert("RGB").convert("L")
        masks.append(normalize(np.array(mask3)))

        return masks
