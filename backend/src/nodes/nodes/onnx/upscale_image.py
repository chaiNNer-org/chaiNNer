from __future__ import annotations

from typing import Tuple, Literal
import numpy as np
import onnxruntime as ort
from sanic.log import logger

from . import category as ONNXCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import OnnxModelInput, ImageInput, TileSizeDropdown
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...utils.auto_split_tiles import parse_tile_size_input, TileSize, NO_TILING
from ...utils.onnx_auto_split import onnx_auto_split
from ...utils.onnx_model import OnnxModel
from ...utils.onnx_session import get_onnx_session
from ...utils.utils import get_h_w_c, convenient_upscale
from ...utils.exec_options import get_execution_options


OnnxInputShape = Literal["BCHW", "BHWC"]


def as_int(value) -> int | None:
    if isinstance(value, int):
        return value
    return None


def get_input_shape(
    session: ort.InferenceSession,
) -> Tuple[OnnxInputShape, int, int | None, int | None]:
    """
    Returns the input shape, input channels, input width (optional), and input height (optional).
    """
    shape = session.get_inputs()[0].shape
    if isinstance(shape[1], int) and shape[1] <= 4:
        return "BCHW", shape[1], as_int(shape[3]), as_int(shape[2])
    else:
        return "BHWC", shape[3], as_int(shape[2]), as_int(shape[1])


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
        exact_size: Tuple[int, int] | None,
    ) -> np.ndarray:
        logger.debug("Upscaling image")

        def estimate():
            raise ValueError

        if exact_size is not None:
            h, w, _ = get_h_w_c(img)
            same_size = (w, h) == exact_size
            assert (
                same_size
            ), f"The current model only support images with a size of {exact_size[0]}x{exact_size[1]}px"
            tile_size = NO_TILING

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

        input_shape, in_nc, req_width, req_height = get_input_shape(session)
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
            lambda i: self.upscale(i, session, tile_size, change_shape, exact_size),
        )
