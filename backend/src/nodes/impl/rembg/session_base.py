from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np
import onnxruntime as ort

from nodes.impl.resize import ResizeFilter, resize


class BaseSession(ABC):
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

    def normalize(self, img: np.ndarray) -> dict[str, np.ndarray]:
        img = resize(img, self.size, ResizeFilter.LANCZOS)

        tmp_img = np.zeros((img.shape[0], img.shape[1], 3))
        tmp_img[:, :, 0] = (img[:, :, 0] - self.mean[0]) / self.std[0]
        tmp_img[:, :, 1] = (img[:, :, 1] - self.mean[1]) / self.std[1]
        tmp_img[:, :, 2] = (img[:, :, 2] - self.mean[2]) / self.std[2]

        tmp_img = tmp_img.transpose((2, 0, 1))

        model_input_name = self.inner_session.get_inputs()[0].name

        return {model_input_name: np.expand_dims(tmp_img, 0).astype(np.float32)}

    @abstractmethod
    def predict(self, img: np.ndarray) -> list[np.ndarray]:
        pass
