from __future__ import annotations

import gc

import torch
import numpy as np
from sanic.log import logger

from ...categories import PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ModelInput, ImageInput, TileModeDropdown
from ...properties.outputs import ImageOutput
from ...utils.exec_options import get_execution_options, ExecutionOptions
from ...utils.torch_types import PyTorchModel
from ...utils.pytorch_utils import to_pytorch_execution_options
from ...utils.pytorch_auto_split import auto_split_process
from ...utils.utils import np2tensor, tensor2np, get_h_w_c, convenient_upscale


@NodeFactory.register("chainner:pytorch:upscale_image")
class ImageUpscaleNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Upscales an image using a PyTorch Super-Resolution model. \
            Select a manual number of tiles if you are having issues with the automatic mode. "
        self.inputs = [
            ModelInput(
                input_type="PyTorchModel { arch: invStrSet(PyTorchModel::FaceArchs) }"
            ),
            ImageInput(),
            TileModeDropdown(),
        ]
        self.outputs = [
            ImageOutput(
                "Upscaled Image",
                image_type="""
                Image {
                    width: Input0.scale * Input1.width,
                    height: Input0.scale * Input1.height,
                    channels: Input1.channels
                }
                """,
            )
        ]

        self.category = PyTorchCategory
        self.name = "Upscale Image"
        self.icon = "PyTorch"
        self.sub = "Processing"

    def upscale(
        self,
        img: np.ndarray,
        model: PyTorchModel,
        scale: int,
        tile_mode: int,
        options: ExecutionOptions,
    ):
        exec_options = to_pytorch_execution_options(get_execution_options())
        should_use_fp16 = (
            exec_options.fp16 and model.supports_fp16
        )  # TODO: use bfloat16 if RTX
        with torch.no_grad():
            # Borrowed from iNNfer
            logger.debug("Converting image to tensor")
            img_tensor = np2tensor(img, change_range=True)
            logger.debug("Upscaling image")

            split_estimation = 1
            if "cuda" in options.device:
                GB_AMT = 1024**3
                free, total = torch.cuda.mem_get_info(options.pytorch_gpu_index)  # type: ignore
                img_bytes = img_tensor.numel() * img_tensor.element_size()
                model_bytes = sum(
                    p.numel() * (p.element_size() / (2 if should_use_fp16 else 1))
                    for p in model.parameters()
                )
                mem_required_estimation = (model_bytes / (1024 * 52)) * img_bytes
                split_estimation = 1
                x = mem_required_estimation
                while x > free:
                    x /= 4
                    split_estimation += 1

                required_mem = f"{mem_required_estimation/GB_AMT:.2f}"
                free_mem = f"{free/GB_AMT:.2f}"
                total_mem = f"{total/GB_AMT:.2f}"
                logger.info(
                    f"Estimating memory required: {required_mem} GB, {free_mem} GB free, {total_mem} GB total. Estimated Split depth: {split_estimation}"
                )
                # Attempt to avoid using too much vram at once
                if float(required_mem) > float(free_mem) * 0.6:
                    split_estimation += 1

            t_out, depth = auto_split_process(
                options,
                img_tensor,
                model,
                scale,
                max_depth=tile_mode if tile_mode > 0 else split_estimation,
            )
            if "cuda" in options.device:
                logger.info(f"Actual Split depth: {depth}")
            del img_tensor
            logger.debug("Converting tensor to image")

            img_out = tensor2np(t_out.detach(), change_range=False, imtype=np.float32)
            logger.debug("Done upscaling")
            del t_out
            gc.collect()
            torch.cuda.empty_cache()
            return img_out

    def run(self, model: PyTorchModel, img: np.ndarray, tile_mode: int) -> np.ndarray:
        """Upscales an image with a pretrained model"""

        exec_options = to_pytorch_execution_options(get_execution_options())

        logger.debug(f"Upscaling image...")

        # TODO: Have all super resolution models inherit from something that forces them to use in_nc and out_nc
        in_nc = model.in_nc
        out_nc = model.out_nc
        scale = model.scale
        h, w, c = get_h_w_c(img)
        logger.debug(
            f"Upscaling a {h}x{w}x{c} image with a {scale}x model (in_nc: {in_nc}, out_nc: {out_nc})"
        )

        return convenient_upscale(
            img,
            in_nc,
            lambda i: self.upscale(i, model, model.scale, tile_mode, exec_options),
        )
