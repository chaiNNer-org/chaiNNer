import cv2
import numpy as np
import torch
from sanic.log import logger

from .helper import norm_img
from .base import InpaintModel


class LaMa(InpaintModel):
    pad_mod = 8

    def init_model(self, device, **kwargs):
        model_path = ''  # need to load model
        logger.info(f"Load LaMa model from: {model_path}")
        model = torch.jit.load("D:/Desktop/onnx_test_models/big-lama.pt", map_location="cpu")
        model = model.to(device)
        model.eval()
        self.model = model
        self.model_path = model_path

    def forward(self, image, mask):
        """Input image and output image have same size
        image: [H, W, C] RGB
        mask: [H, W]
        return: BGR IMAGE
        """
        image = norm_img(image)
        mask = norm_img(mask)

        mask = (mask > 0) * 1
        image = torch.from_numpy(image).unsqueeze(0).to(self.device)
        mask = torch.from_numpy(mask).unsqueeze(0).to(self.device)

        inpainted_image = self.model(image, mask)

        cur_res = inpainted_image[0].permute(1, 2, 0).detach().cpu().numpy()
        cur_res = np.clip(cur_res * 255, 0, 255).astype("uint8")
        cur_res = cv2.cvtColor(cur_res, cv2.COLOR_RGB2BGR)
        return cur_res
