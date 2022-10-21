from __future__ import annotations

import numpy as np
import onnxruntime as ort
from sanic.log import logger

from . import category as ONNXCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import OnnxModelInput, ImageInput, TileSizeDropdown
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.auto_split_tiles import parse_tile_size_input, TileSize
from ...utils.onnx_auto_split import onnx_auto_split
from ...utils.onnx_model import OnnxModel
from ...utils.onnx_session import get_onnx_session
from ...utils.utils import get_h_w_c, convenient_upscale
from ...utils.exec_options import get_execution_options


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
                image_type=expression.Image(channels="Input1.channels"),
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
    ) -> np.ndarray:
        logger.debug("Upscaling image")

        def estimate():
            raise ValueError

        return onnx_auto_split(
            img,
            session,
            change_shape=change_shape,
            tiler=parse_tile_size_input(tile_size, estimate),
        )

    def run(
        self,
        model: OnnxModel,
        img: np.ndarray,
        tile_size: TileSize,
    ) -> np.ndarray:
        """Upscales an image with a pretrained model"""
        session = get_onnx_session(model, get_execution_options())
        shape = session.get_inputs()[0].shape
        if isinstance(shape[1], int) and shape[1] <= 4:
            in_nc = shape[1]
            change_shape = False
        else:
            in_nc = shape[3]
            change_shape = True

        h, w, c = get_h_w_c(img)
        logger.debug(f"Image is {h}x{w}x{c}")

        return convenient_upscale(
            img,
            in_nc,
            lambda i: self.upscale(i, session, tile_size, change_shape),
        )
