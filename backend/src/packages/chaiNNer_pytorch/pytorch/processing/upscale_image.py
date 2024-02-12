from __future__ import annotations

import numpy as np
import psutil
import torch
from sanic.log import logger
from spandrel import ImageModelDescriptor, ModelTiling

from api import NodeContext
from nodes.groups import Condition, if_group
from nodes.impl.pytorch.auto_split import pytorch_auto_split
from nodes.impl.upscale.auto_split_tiles import (
    NO_TILING,
    TileSize,
    estimate_tile_size,
    parse_tile_size_input,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import MaxTileSize
from nodes.properties.inputs import (
    BoolInput,
    ImageInput,
    SrModelInput,
    TileSizeDropdown,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import PyTorchSettings, get_settings
from .. import processing_group


def upscale(
    img: np.ndarray,
    model: ImageModelDescriptor,
    tile_size: TileSize,
    options: PyTorchSettings,
):
    with torch.no_grad():
        # Borrowed from iNNfer
        logger.debug("Upscaling image")

        # TODO: use bfloat16 if RTX
        use_fp16 = options.use_fp16 and model.supports_half
        device = options.device

        if model.tiling == ModelTiling.INTERNAL:
            # disable tiling if the model already does it internally
            tile_size = NO_TILING

        def estimate():
            element_size = 2 if use_fp16 else 4
            model_bytes = sum(
                p.numel() * element_size for p in model.model.parameters()
            )

            if "cuda" in device.type:
                mem_info: tuple[int, int] = torch.cuda.mem_get_info(device)  # type: ignore
                free, _total = mem_info
                element_size = 2 if use_fp16 else 4
                if options.budget_limit > 0:
                    free = min(options.budget_limit * 1024**3, free)
                budget = int(free * 0.8)

                return MaxTileSize(
                    estimate_tile_size(
                        budget,
                        model_bytes,
                        img,
                        element_size,
                    )
                )
            elif device.type == "cpu":
                free = psutil.virtual_memory().available
                if options.budget_limit > 0:
                    free = min(options.budget_limit * 1024**3, free)
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
    description=(
        "Upscales an image using a PyTorch Super-Resolution model. Select a"
        " manual number of tiles if you are having issues with the automatic mode. "
    ),
    icon="PyTorch",
    inputs=[
        ImageInput()
        .with_id(1)
        .with_suggestions(
            "chainner:image:load",
        ),
        SrModelInput()
        .with_id(0)
        .with_suggestions(
            "chainner:pytorch:load_model",
        ),
        if_group(
            Condition.type(
                0,
                "PyTorchModel { tiling: ModelTiling::Supported | ModelTiling::Discouraged } ",
                if_not_connected=True,
            )
        )(
            TileSizeDropdown()
            .with_id(2)
            .with_docs(
                "Tiled upscaling is used to allow large images to be upscaled without"
                " hitting memory limits.",
                "This works by splitting the image into tiles (with overlap), upscaling"
                " each tile individually, and seamlessly recombining them.",
                "Generally it's recommended to use the largest tile size possible for"
                " best performance (with the ideal scenario being no tiling at all),"
                " but depending on the model and image size, this may not be possible.",
                "If you are having issues with the automatic mode, you can manually"
                " select a tile size. Sometimes, a manually selected tile size may be"
                " faster than what the automatic mode picks.",
                hint=True,
            ),
        ),
        if_group(
            Condition.type(1, "Image { channels: 4 } ")
            & (
                Condition.type(
                    0, "PyTorchModel { inputChannels: 1, outputChannels: 1 }"
                )
                | Condition.type(
                    0, "PyTorchModel { inputChannels: 3, outputChannels: 3 }"
                )
            )
        )(
            BoolInput("Separate Alpha", default=False).with_docs(
                "Upscale alpha separately from color. Enabling this option will cause the alpha of"
                " the upscaled image to be less noisy and more accurate to the alpha of the original"
                " image, but the image may suffer from dark borders near transparency edges"
                " (transition from fully transparent to fully opaque).",
                "Whether enabling this option will improve the upscaled image depends on the original"
                " image. We generally recommend this option for images with smooth transitions between"
                " transparent and opaque regions.",
            )
        ),
    ],
    outputs=[
        ImageOutput(
            "Image",
            image_type="""convenientUpscale(Input0, Input1)""",
            assume_normalized=True,  # pytorch_auto_split already does clipping internally
        )
    ],
    node_context=True,
)
def upscale_image_node(
    context: NodeContext,
    img: np.ndarray,
    model: ImageModelDescriptor,
    tile_size: TileSize,
    separate_alpha: bool,
) -> np.ndarray:
    exec_options = get_settings(context)

    logger.debug("Upscaling image...")

    in_nc = model.input_channels
    out_nc = model.output_channels
    scale = model.scale
    h, w, c = get_h_w_c(img)
    logger.debug(
        f"Upscaling a {h}x{w}x{c} image with a {scale}x model (in_nc: {in_nc}, out_nc:"
        f" {out_nc})"
    )

    return convenient_upscale(
        img,
        in_nc,
        out_nc,
        lambda i: upscale(i, model, tile_size, exec_options),
        separate_alpha,
        clip=False,  # pytorch_auto_split already does clipping internally
    )
