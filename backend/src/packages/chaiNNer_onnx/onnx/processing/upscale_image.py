from __future__ import annotations

from typing import Tuple

import numpy as np
import onnxruntime as ort
from sanic.log import logger

from nodes.impl.onnx.auto_split import onnx_auto_split
from nodes.impl.onnx.model import OnnxModel
from nodes.impl.onnx.session import get_onnx_session
from nodes.impl.onnx.utils import get_input_shape, get_output_shape
from nodes.impl.upscale.auto_split_tiles import (
    TILE_SIZE_256,
    TileSize,
    parse_tile_size_input,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import ExactTileSize
from nodes.properties.inputs import ImageInput, OnnxGenericModelInput, TileSizeDropdown
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import get_settings
from .. import processing_group


def upscale(
    img: np.ndarray,
    session: ort.InferenceSession,
    tile_size: TileSize,
    change_shape: bool,
    exact_size: Tuple[int, int] | None,
) -> np.ndarray:
    logger.debug("Upscaling image")

    if exact_size is None:

        def estimate():
            raise ValueError

        tiler = parse_tile_size_input(tile_size, estimate)
    else:
        tiler = ExactTileSize(exact_size)

    return onnx_auto_split(img, session, change_shape=change_shape, tiler=tiler)


@processing_group.register(
    schema_id="chainner:onnx:upscale_image",
    description=(
        "Upscales an image using an ONNX Super-Resolution model. ONNX does"
        " not support automatic out-of-memory handling via automatic tiling."
        "  Therefore, you must set a Smart Tiling Mode manually. If you get an"
        " out-of-memory error, try picking a setting further down the list."
    ),
    inputs=[
        ImageInput().with_id(1),
        OnnxGenericModelInput().with_id(0),
        TileSizeDropdown(estimate=False, default=TILE_SIZE_256)
        .with_id(2)
        .with_docs(
            "Tiled upscaling is used to allow large images to be upscaled without"
            " hitting memory limits.",
            "This works by splitting the image into tiles (with overlap), upscaling"
            " each tile individually, and seamlessly recombining them.",
            "Generally it's recommended to use the largest tile size possible for best"
            " performance, but depending on the model and image size, this may not be"
            " possible.",
            "ONNX upscaling does not support an automatic mode, meaning you may need to"
            " manually select a tile size for it to work.",
        ),
    ],
    outputs=[ImageOutput("Image")],
    name="Upscale Image",
    icon="ONNX",
)
def upscale_image_node(
    img: np.ndarray,
    model: OnnxModel,
    tile_size: TileSize,
) -> np.ndarray:
    """Upscales an image with a pretrained model"""
    settings = get_settings()
    session = get_onnx_session(
        model,
        settings.gpu_index,
        settings.execution_provider,
        settings.should_tensorrt_cache,
        settings.tensorrt_fp16_mode,
        settings.tensorrt_cache_path,
    )

    input_shape, in_nc, req_width, req_height = get_input_shape(session)
    _, out_nc, _, _ = get_output_shape(session)
    change_shape = input_shape == "BHWC"

    exact_size = None
    if req_width is not None:
        exact_size = req_width, req_height or req_width
    elif req_height is not None:
        exact_size = req_width or req_height, req_height

    h, w, c = get_h_w_c(img)
    logger.debug(f"Image is {h}x{w}x{c}")

    return convenient_upscale(
        img,
        in_nc,
        out_nc,
        lambda i: upscale(i, session, tile_size, change_shape, exact_size),
    )
