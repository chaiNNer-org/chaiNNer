from __future__ import annotations

from typing import Tuple, Union

import torch
import numpy as np
from sanic.log import logger

from ...categories import PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ModelInput, ImageInput, TileSizeDropdown
from ...properties.outputs import ImageOutput
from ...utils.exec_options import get_execution_options, ExecutionOptions
from ...utils.torch_types import PyTorchModel
from ...utils.pytorch_utils import to_pytorch_execution_options
from ...utils.pytorch_auto_split import pytorch_auto_split
from ...utils.utils import get_h_w_c, convenient_upscale


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
            TileSizeDropdown(),
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
        tile_size: Union[int, None],
        options: ExecutionOptions,
    ):
        with torch.no_grad():
            # Borrowed from iNNfer
            logger.debug("Upscaling image")

            # TODO: use bfloat16 if RTX
            use_fp16 = options.fp16 and model.supports_fp16
            device = torch.device(options.device)

            def estimate_tile_size() -> Union[int, None]:
                if "cuda" in options.device:
                    mem_info: Tuple[int, int] = torch.cuda.mem_get_info(device)  # type: ignore
                    free, total = mem_info

                    element_size = 2 if use_fp16 else 4

                    h, w, c = get_h_w_c(img)
                    img_bytes = h * w * c * element_size
                    model_bytes = sum(
                        p.numel() * element_size for p in model.parameters()
                    )
                    mem_required_estimation = (model_bytes / (1024 * 52)) * img_bytes

                    # Attempt to avoid using too much vram at once
                    free_allowed_usage = 0.6
                    tile_pixels = (
                        w * h * (free * free_allowed_usage) / mem_required_estimation
                    )
                    # the largest power-of-2 tile_size such that tile_size**2 < tile_pixels
                    tile_size = 2 ** (int(tile_pixels**0.5).bit_length() - 1)

                    GB_AMT = 1024**3
                    required_mem = f"{mem_required_estimation/GB_AMT:.2f}"
                    free_mem = f"{free/GB_AMT:.2f}"
                    total_mem = f"{total/GB_AMT:.2f}"
                    logger.info(
                        f"Estimating memory required: {required_mem} GB, {free_mem} GB free, {total_mem} GB total."
                        f" Estimated tile size: {tile_size}"
                    )

                    return tile_size

            img_out = pytorch_auto_split(
                img,
                model=model,
                device=device,
                use_fp16=use_fp16,
                max_tile_size=tile_size
                if tile_size is not None
                else estimate_tile_size(),
            )
            logger.debug("Done upscaling")

            return img_out

    def run(self, model: PyTorchModel, img: np.ndarray, tile_size: int) -> np.ndarray:
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
            lambda i: self.upscale(
                i,
                model,
                tile_size if tile_size > 0 else None,
                exec_options,
            ),
        )
