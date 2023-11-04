from __future__ import annotations

import numpy as np
import onnxruntime as ort
from PIL import Image
from PIL.Image import Image as PILImage


class BaseSession:
    def __init__(
        self,
        inner_session: ort.InferenceSession,
        mean: tuple[float, float, float],
        std: tuple[float, float, float],
        size: tuple[int, int],
    ):
        self.inner_session = inner_session
        self.mean = mean
        self.std = std
        self.size = size

    def normalize(self, img: PILImage) -> dict[str, np.ndarray]:
        im = img.convert("RGB").resize(self.size, Image.LANCZOS)
        im_ary = np.array(im)
        im_ary = im_ary / np.max(im_ary)

        tmp_img = np.zeros((im_ary.shape[0], im_ary.shape[1], 3))
        tmp_img[:, :, 0] = (im_ary[:, :, 0] - self.mean[0]) / self.std[0]
        tmp_img[:, :, 1] = (im_ary[:, :, 1] - self.mean[1]) / self.std[1]
        tmp_img[:, :, 2] = (im_ary[:, :, 2] - self.mean[2]) / self.std[2]

        tmp_img = tmp_img.transpose((2, 0, 1))

        model_input_name = self.inner_session.get_inputs()[0].name

        return {model_input_name: np.expand_dims(tmp_img, 0).astype(np.float32)}

    def predict(self, _: PILImage) -> list[PILImage]:
        raise NotImplementedError
