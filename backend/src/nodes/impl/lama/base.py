import abc
from typing import Optional

import torch
import numpy as np
from sanic.log import logger

from .helper import pad_img_to_modulo


class InpaintModel:
    min_size: Optional[int] = None
    pad_mod = 8
    pad_to_square = False

    def __init__(self, device, **kwargs):
        """
        Args:
            device:
        """
        self.device = device
        self.init_model(device, **kwargs)

    @abc.abstractmethod
    def init_model(self, device, **kwargs):
        ...

    @staticmethod
    @abc.abstractmethod
    def is_downloaded() -> bool:
        ...

    @abc.abstractmethod
    def forward(self, image, mask):
        """Input images and output images have same size
        images: [H, W, C] RGB
        masks: [H, W, 1] 255 为 masks 区域
        return: BGR IMAGE
        """
        ...

    def _pad_forward(self, image, mask):
        origin_height, origin_width = image.shape[:2]
        pad_image = pad_img_to_modulo(
            image, mod=self.pad_mod, square=self.pad_to_square, min_size=self.min_size
        )
        pad_mask = pad_img_to_modulo(
            mask, mod=self.pad_mod, square=self.pad_to_square, min_size=self.min_size
        )

        logger.info(f"final forward pad size: {pad_image.shape}")

        result = self.forward(pad_image, pad_mask)
        result = result[0:origin_height, 0:origin_width, :]

        result, image, mask = self.forward_post_process(result, image, mask)

        mask = mask[:, :, np.newaxis]
        result = result * (mask / 255) + image[:, :, ::-1] * (1 - (mask / 255))
        return result

    def forward_post_process(self, result, image, mask):
        return result, image, mask

    @torch.no_grad()
    def __call__(self, image, mask):
        """
        images: [H, W, C] RGB, not normalized
        masks: [H, W]
        return: BGR IMAGE
        """
        inpaint_result = None
        if inpaint_result is None:
            inpaint_result = self._pad_forward(image, mask)

        return inpaint_result
