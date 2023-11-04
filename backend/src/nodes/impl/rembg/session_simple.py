from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from .session_base import BaseSession

if TYPE_CHECKING:
    from PIL.Image import Image as PILImage


class SimpleSession(BaseSession):
    def predict(self, img: PILImage) -> list[PILImage]:
        ort_outs = self.inner_session.run(None, self.normalize(img))

        pred = ort_outs[0][:, 0, :, :]

        ma = np.max(pred)
        mi = np.min(pred)

        pred = (pred - mi) / (ma - mi)
        pred = np.squeeze(pred)

        mask = Image.fromarray((pred * 255).astype("uint8"), mode="L")
        mask = mask.resize(img.size, Image.LANCZOS)

        return [mask]
