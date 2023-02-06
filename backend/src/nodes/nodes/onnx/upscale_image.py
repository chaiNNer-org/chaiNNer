from __future__ import annotations

from typing import Tuple

import numpy as np
import onnxruntime as ort
from sanic.log import logger

from ...impl.onnx.auto_split import onnx_auto_split
from ...impl.onnx.model import OnnxModel
from ...impl.onnx.session import get_onnx_session
from ...impl.onnx.utils import get_input_shape, get_output_shape
from ...impl.upscale.auto_split import ExactTileSize
from ...impl.upscale.auto_split_tiles import TileSize, parse_tile_size_input
from ...impl.upscale.convenient_upscale import convenient_upscale
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, OnnxModelInput, TileSizeDropdown
from ...properties.outputs import ImageOutput
from ...utils.exec_options import get_execution_options
from ...utils.utils import get_h_w_c
from . import category as ONNXCategory


@NodeFactory.register("chainner:onnx:upscale_image")
class OnnxImageUpscaleNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Upscales an image using an ONNX Super-Resolution model. \
            ONNX does not support automatic out-of-memory handling via automatic tiling. \
            Therefore, you must set a Smart Tiling Mode manually. If you get an out-of-memory error, try picking a setting further down the list."
        self.inputs = [
            OnnxModelInput(),
            ImageInput(),
            TileSizeDropdown(estimate=False),
        ]
        self.outputs = [
            ImageOutput(
                "Upscaled Image",
                image_type="""convenientUpscale(Input0, Input1)""",
            )
        ]

        self.category = ONNXCategory
        self.name = "Upscale Image"
        self.icon = "ONNX"
        self.sub = "Processing"

    def upscale(
        self,
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

    def run(
        self,
        model: OnnxModel,
        img: np.ndarray,
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
            lambda i: self.upscale(i, session, tile_size, change_shape, exact_size),
        )
