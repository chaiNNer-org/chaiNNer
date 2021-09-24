import logging
from typing import Any, OrderedDict

import numpy as np
import torch

from .NodeBase import NodeBase
from .NodeFactory import NodeFactory
from .properties.inputs.FileInputs import PthFileInput
from .properties.inputs.NumPyInputs import ImageInput
from .properties.inputs.PyTorchInputs import ModelInput, StateDictInput
from .properties.outputs.NumPyOutputs import ImageOutput
from .properties.outputs.PyTorchOutputs import ModelOutput, StateDictOutput
from .utils.architectures.RRDB import RRDBNet
from .utils.utils import auto_split_process, np2tensor, tensor2np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@NodeFactory.register("PyTorch", "PyTorch::Read")
class LoadStateDictNode(NodeBase):
    """ Load Model node """

    def __init__(self):
        """ Constructor """
        self.inputs = [PthFileInput()]
        self.outputs = [StateDictOutput()]

    def run(self, path: str) -> OrderedDict:
        """ Read a pth file from the specified path and return it as a state dict """

        logger.info(f"Reading state dict from path: {path}")
        state_dict = torch.load(path)

        return state_dict


@NodeFactory.register("PyTorch", "ESRGAN::Load")
class LoadEsrganModelNode(NodeBase):
    """ Load ESRGAN Model node """

    def __init__(self):
        """ Constructor """
        self.inputs = [StateDictInput()]
        self.outputs = [ModelOutput()]

    def run(self, state_dict: OrderedDict) -> Any:
        """ Loads the state dict to an ESRGAN model after finding arch config """

        logger.info(f"Loading state dict into ESRGAN model")

        # Convert a 'new-arch' model to 'old-arch'
        if "conv_first.weight" in state_dict:
            state_dict = self.convert_new_to_old(state_dict)

        # extract model information
        scale2 = 0
        max_part = 0
        in_nc = 0
        out_nc = 0
        plus = False
        for part in list(state_dict):
            parts = part.split(".")
            n_parts = len(parts)
            if n_parts == 5 and parts[2] == "sub":
                nb = int(parts[3])
            elif n_parts == 3:
                part_num = int(parts[1])
                if part_num > 6 and parts[0] == "model" and parts[2] == "weight":
                    scale2 += 1
                if part_num > max_part:
                    max_part = part_num
                    out_nc = state_dict[part].shape[0]
            if "conv1x1" in part and not plus:
                plus = True

        upscale = 2 ** scale2
        in_nc = state_dict["model.0.weight"].shape[1]
        nf = state_dict["model.0.weight"].shape[0]

        model = RRDBNet(
            in_nc=in_nc,
            out_nc=out_nc,
            nf=nf,
            nb=nb,
            gc=32,
            upscale=upscale,
            norm_type=None,
            act_type="leakyrelu",
            mode="CNA",
            upsample_mode="upconv",
            plus=plus,
        )

        model.load_state_dict(state_dict, strict=True)
        for k, v in model.named_parameters():
            v.requires_grad = False
        model.eval()
        model.to(torch.device("cuda"))

        return model

    def convert_new_to_old(self, state_dict):
        logger.warn("Attempting to convert and load a new-format model")
        old_net = {}
        items = []
        for k, _ in state_dict.items():
            items.append(k)

        old_net["model.0.weight"] = state_dict["conv_first.weight"]
        old_net["model.0.bias"] = state_dict["conv_first.bias"]

        for k in items.copy():
            if "RDB" in k:
                ori_k = k.replace("RRDB_trunk.", "model.1.sub.")
                if ".weight" in k:
                    ori_k = ori_k.replace(".weight", ".0.weight")
                elif ".bias" in k:
                    ori_k = ori_k.replace(".bias", ".0.bias")
                old_net[ori_k] = state_dict[k]
                items.remove(k)

        old_net["model.1.sub.23.weight"] = state_dict["trunk_conv.weight"]
        old_net["model.1.sub.23.bias"] = state_dict["trunk_conv.bias"]
        old_net["model.3.weight"] = state_dict["upconv1.weight"]
        old_net["model.3.bias"] = state_dict["upconv1.bias"]
        old_net["model.6.weight"] = state_dict["upconv2.weight"]
        old_net["model.6.bias"] = state_dict["upconv2.bias"]
        old_net["model.8.weight"] = state_dict["HRconv.weight"]
        old_net["model.8.bias"] = state_dict["HRconv.bias"]
        old_net["model.10.weight"] = state_dict["conv_last.weight"]
        old_net["model.10.bias"] = state_dict["conv_last.bias"]
        return old_net


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
