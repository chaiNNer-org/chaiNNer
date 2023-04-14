from __future__ import annotations

from typing import Tuple

import numpy as np
import torch
from sanic.log import logger

from nodes.impl.pytorch.auto_split import pytorch_auto_split
from nodes.impl.pytorch.types import PyTorchSRModel
from nodes.impl.pytorch.utils import to_pytorch_execution_options
from nodes.impl.upscale.auto_split_tiles import (
    TileSize,
    estimate_tile_size,
    parse_tile_size_input,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import MaxTileSize
from nodes.properties.inputs import ImageInput, SrModelInput, TileSizeDropdown
from nodes.properties.outputs import ImageOutput
from nodes.utils.exec_options import ExecutionOptions, get_execution_options
from nodes.utils.utils import get_h_w_c

from .. import processing_group


def upscale(
    img: np.ndarray,
    model: PyTorchSRModel,
    tile_size: TileSize,
    options: ExecutionOptions,
):
    with torch.no_grad():
        # Borrowed from iNNfer
        logger.debug("Upscaling image")

        # TODO: use bfloat16 if RTX
        use_fp16 = options.fp16 and model.supports_fp16
        device = torch.device(options.full_device)

        def estimate():
            if "cuda" in options.full_device:
                mem_info: Tuple[int, int] = torch.cuda.mem_get_info(device)  # type: ignore
                free, _total = mem_info
                element_size = 2 if use_fp16 else 4
                model_bytes = sum(p.numel() * element_size for p in model.parameters())
                budget = int(free * 0.8)

                return MaxTileSize(
                    estimate_tile_size(
                        budget,
                        model_bytes,
                        img,
                        element_size,
                    )
                )
            return MaxTileSize()

        img_out = pytorch_auto_split(
            img,
            model=model,
            device=device,
            use_fp16=use_fp16,
            tiler=parse_tile_size_input(tile_size, estimate),
        )
        logger.debug("Done upscaling")

        return img_out


@processing_group.register(
    schema_id="chainner:pytorch:upscale_image",
    name="Upscale Image",
    description="Upscales an image using a PyTorch Super-Resolution model. \
            Select a manual number of tiles if you are having issues with the automatic mode. ",
    icon="PyTorch",
    inputs=[
        ImageInput().with_id(1),
        SrModelInput().with_id(0),
        TileSizeDropdown().with_id(2),
    ],
    outputs=[
        ImageOutput(
            "Upscaled Image",
            image_type="""convenientUpscale(Input0, Input1)""",
        )
    ],
)
def upscale_image_node(
    img: np.ndarray,
    model: PyTorchSRModel,
    tile_size: TileSize,
) -> np.ndarray:
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
        out_nc,
        lambda i: upscale(i, model, tile_size, exec_options),
    )
