from __future__ import annotations

import numpy as np

from api import NodeContext, Progress
from logger import logger
from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.tensorrt.auto_split import tensorrt_auto_split
from nodes.impl.tensorrt.inference import clear_session_cache
from nodes.impl.tensorrt.model import TensorRTEngine
from nodes.impl.upscale.auto_split_tiles import (
    CUSTOM,
    MAX_TILE_SIZE,
    NO_TILING,
    TILE_SIZE_256,
    TileSize,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import BoundedTileSize, NoTiling, Tiler
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
    tiler: Tiler,
    gpu_index: int,
    progress: Progress | None,
) -> np.ndarray:
    logger.debug("Upscaling image with TensorRT")
    return tensorrt_auto_split(
        img, engine, tiler, gpu_index=gpu_index, progress=progress
    )


def create_tiler_for_engine(
    engine: TensorRTEngine, tile_size: TileSize, custom_tile_size: int
) -> Tiler:
    """
    Create an appropriate tiler based on the engine's constraints and tile size setting.
    """
    # Extract min/max size constraints from engine info
    # Shape tuples are NCHW format: (batch, channels, height, width)
    info = engine.info
    min_size = None
    max_size = None

    if info.min_shape is not None:
        min_size = (info.min_shape[3], info.min_shape[2])  # (width, height)
    if info.max_shape is not None:
        max_size = (info.max_shape[3], info.max_shape[2])  # (width, height)

    if tile_size == NO_TILING:
        # No tiling - use the whole image (type validation ensures it fits within bounds)
        return NoTiling()
    elif tile_size == MAX_TILE_SIZE:
        # Use the maximum size allowed by the engine
        if max_size is not None:
            size = min(max_size[0], max_size[1])
        else:
            size = 2**31  # Effectively unlimited
        return BoundedTileSize(size, min_size=min_size, max_size=max_size)
    elif tile_size == CUSTOM:
        return BoundedTileSize(custom_tile_size, min_size=min_size, max_size=max_size)
    else:
        # Numeric tile size
        return BoundedTileSize(int(tile_size), min_size=min_size, max_size=max_size)


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
                image_type="""
                    let engine = Input0;
                    let image = Input1;
                    let tileSize = Input2;

                    // Only validate image dimensions when "No Tiling" is selected (value == -1)
                    // Otherwise, the BoundedTileSize tiler handles constraints at runtime
                    let noTiling = tileSize.value == -1;

                    // Check minimum size constraints
                    let minWidthOk = match engine.minWidth {
                        null => true,
                        _ as w => image.width >= w
                    };
                    let minHeightOk = match engine.minHeight {
                        null => true,
                        _ as h => image.height >= h
                    };

                    // Check maximum size constraints
                    let maxWidthOk = match engine.maxWidth {
                        null => true,
                        _ as w => image.width <= w
                    };
                    let maxHeightOk = match engine.maxHeight {
                        null => true,
                        _ as h => image.height <= h
                    };

                    if noTiling and (not minWidthOk or not minHeightOk) {
                        error("Image is smaller than the minimum size supported by this TensorRT engine. Use tiling or resize the image.")
                    } else if noTiling and (not maxWidthOk or not maxHeightOk) {
                        error("Image is larger than the maximum size supported by this TensorRT engine. Use tiling or resize the image.")
                    } else {
                        convenientUpscaleTrt(engine, image)
                    }
                """,
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

        # Create the appropriate tiler based on engine constraints and tile size setting
        tiler = create_tiler_for_engine(engine, tile_size, custom_tile_size)

        return convenient_upscale(
            img,
            in_nc,
            out_nc,
            lambda i, p: upscale(i, engine, tiler, gpu_index, p),
            separate_alpha,
            progress=context,
        )
