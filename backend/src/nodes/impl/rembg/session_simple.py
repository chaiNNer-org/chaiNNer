from __future__ import annotations

import numpy as np

from nodes.impl.image_utils import normalize
from nodes.impl.resize import ResizeFilter, resize
from nodes.utils.utils import get_h_w_c

from .session_base import BaseSession


class SimpleSession(BaseSession):
    def predict(self, img: np.ndarray) -> list[np.ndarray]:
        h, w, _ = get_h_w_c(img)
        ort_outs = self.inner_session.run(None, self.normalize(img))

        pred = ort_outs[0][:, 0, :, :]

        ma = np.max(pred)
        mi = np.min(pred)

        pred = (pred - mi) / (ma - mi)
        mask = normalize(np.squeeze(pred))
        mask = np.squeeze(resize(mask, (w, h), ResizeFilter.LANCZOS))

        return [mask]
