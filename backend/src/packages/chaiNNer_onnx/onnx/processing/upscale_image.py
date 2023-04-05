from __future__ import annotations

from typing import Tuple

import numpy as np
import onnxruntime as ort
from sanic.log import logger

from nodes.impl.onnx.auto_split import onnx_auto_split
from nodes.impl.onnx.model import OnnxModel
from nodes.impl.onnx.session import get_onnx_session
from nodes.impl.onnx.utils import get_input_shape, get_output_shape
from nodes.impl.upscale.auto_split_tiles import TileSize, parse_tile_size_input
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import ExactTileSize
from nodes.properties.inputs import ImageInput, OnnxGenericModelInput, TileSizeDropdown
from nodes.properties.outputs import ImageOutput
from nodes.utils.exec_options import get_execution_options
from nodes.utils.utils import get_h_w_c

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
    description="Upscales an image using an ONNX Super-Resolution model. \
            ONNX does not support automatic out-of-memory handling via automatic tiling. \
            Therefore, you must set a Smart Tiling Mode manually. If you get an out-of-memory error, try picking a setting further down the list.",
    inputs=[
        ImageInput().with_id(1),
        OnnxGenericModelInput().with_id(0),
        TileSizeDropdown(estimate=False).with_id(2),
    ],
    outputs=[ImageOutput("Upscaled Image")],
    name="Upscale Image",
    icon="ONNX",
)
def upscale_image_node(
    img: np.ndarray,
    model: OnnxModel,
    tile_size: TileSize,
) -> np.ndarray:
    """Upscales an image with a pretrained model"""
    session = get_onnx_session(model, get_execution_options())

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
