from __future__ import annotations

import numpy as np

from api import NodeContext
from logger import logger
from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.tensorrt.auto_split import tensorrt_auto_split
from nodes.impl.tensorrt.inference import clear_session_cache
from nodes.impl.tensorrt.model import TensorRTEngine
from nodes.impl.upscale.auto_split_tiles import (
    CUSTOM,
    TILE_SIZE_256,
    TileSize,
    parse_tile_size_input,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import MaxTileSize
from nodes.properties.inputs import (
    BoolInput,
    ImageInput,
    NumberInput,
    TensorRTEngineInput,
    TileSizeDropdown,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import get_settings
from .. import processing_group


def upscale(
    img: np.ndarray,
    engine: TensorRTEngine,
    tile_size: TileSize,
    gpu_index: int,
) -> np.ndarray:
    logger.debug("Upscaling image with TensorRT")

    def estimate():
        # Conservative estimate for TensorRT
        return MaxTileSize(TILE_SIZE_256)

    tiler = parse_tile_size_input(tile_size, estimate)

    return tensorrt_auto_split(img, engine, tiler, gpu_index=gpu_index)


if processing_group is not None:

    @processing_group.register(
        schema_id="chainner:tensorrt:upscale_image",
        description=(
            "Upscales an image using a TensorRT engine. TensorRT provides optimized GPU inference "
            "for maximum performance. If you encounter out-of-memory errors, try using a smaller tile size."
        ),
        inputs=[
            ImageInput().with_id(1),
            TensorRTEngineInput().with_id(0),
            TileSizeDropdown(estimate=False, default=TILE_SIZE_256)
            .with_id(2)
            .with_docs(
                "Tiled upscaling is used to allow large images to be upscaled without hitting memory limits.",
                "This works by splitting the image into tiles (with overlap), upscaling each tile individually, and seamlessly recombining them.",
                "Generally it's recommended to use the largest tile size possible for best performance, but depending on the model and image size, this may not be possible.",
            ),
            if_enum_group(2, CUSTOM)(
                NumberInput(
                    "Custom Tile Size",
                    min=1,
                    max=None,
                    default=TILE_SIZE_256,
                    unit="px",
                )
            ),
            if_group(Condition.type(1, "Image { channels: 4 } "))(
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
                image_type="convenientUpscaleTrt(Input0, Input1)",
            )
        ],
        name="Upscale Image",
        icon="BsNvidia",
        node_context=True,
    )
    def upscale_image_node(
        context: NodeContext,
        img: np.ndarray,
        engine: TensorRTEngine,
        tile_size: TileSize,
        custom_tile_size: int,
        separate_alpha: bool,
    ) -> np.ndarray:
        settings = get_settings(context)
        gpu_index = settings.gpu_index

        context.add_cleanup(clear_session_cache, after="chain")

        in_nc = engine.input_channels
        out_nc = engine.output_channels

        h, w, c = get_h_w_c(img)
        logger.debug("Image is %dx%dx%d", h, w, c)

        return convenient_upscale(
            img,
            in_nc,
            out_nc,
            lambda i: upscale(
                i,
                engine,
                TileSize(custom_tile_size) if tile_size == CUSTOM else tile_size,
                gpu_index,
            ),
            separate_alpha,
        )
