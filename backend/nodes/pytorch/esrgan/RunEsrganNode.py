import logging
from typing import Any

import numpy as np
import torch

from ...NodeBase import NodeBase
from ...NodeFactory import NodeFactory
from ...properties.inputs.NumPyInputs import ImageInput
from ...properties.inputs.PyTorchInputs import ModelInput
from ...properties.outputs.NumPyOutputs import ImageOutput
from ..architectures.RRDB import RRDBNet
from ..utils.utils import auto_split_process, np2tensor, tensor2np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@NodeFactory.register("PyTorch", "ESRGAN::Run")
class EsrganNode(NodeBase):
    """ ESRGAN node """

    def __init__(self):
        """ Constructor """
        self.inputs = [ModelInput(), ImageInput()]
        self.outputs = [ImageOutput("Upscaled Image")]

    def run(self, model: RRDBNet, img: np.ndarray) -> np.ndarray:
        """ Upscales an image with an ESRGAN pretrained model """

        logger.info(f"Upscaling image...")

        img = img / np.iinfo(img.dtype).max

        in_nc = model.in_nc
        out_nc = model.out_nc
        scale = model.scale
        h, w = img.shape[:2]
        c = img.shape[2] if len(img.shape) > 2 else 1
        logger.info(
            f"Upscaling a {h}x{w}x{c} image with a {scale}x model (in_nc: {in_nc}, out_nc: {out_nc})"
        )

        # Ensure correct amount of image channels for the model.
        # The frontend should type-validate this enough where it shouldn't be needed,
        # But I want to be extra safe

        # # Add extra channels if not enough (i.e single channel img, three channel model)
        if img.ndim == 2:
            logger.warn("Expanding image channels")
            img = np.tile(np.expand_dims(img, axis=2), (1, 1, min(in_nc, 3)))
        # Remove extra channels if too many (i.e three channel image, single channel model)
        elif img.shape[2] > in_nc:
            logger.warn("Truncating image channels")
            img = img[:, :, :in_nc]
        # Pad with solid alpha channel if needed (i.e three channel image, four channel model)
        elif img.shape[2] == 3 and in_nc == 4:
            logger.warn("Expanding image channels")
            img = np.dstack((img, np.full(img.shape[:-1], 1.0)))

        # Borrowed from iNNfer
        logger.info("Converting image to tensor")
        t_img = np2tensor(img).to(torch.device("cuda"))
        # t_out = t_img.clone()
        logger.info("Upscaling image")
        t_out, _ = auto_split_process(
            t_img,
            model,
            scale,
        )
        # t_out = model(t_out)
        logger.info("Converting tensor to image")
        img_out = tensor2np(t_out.detach())
        logger.info("Done upscaling")

        return img_out
