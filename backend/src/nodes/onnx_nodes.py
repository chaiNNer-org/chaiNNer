from __future__ import annotations

import os
from typing import Tuple

import numpy as np
import onnx
import onnxruntime as ort
from sanic.log import logger

from .categories import ONNX
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.onnx_auto_split import onnx_auto_split_process
from .utils.utils import get_h_w_c, np2nptensor, nptensor2np, convenient_upscale


class TensorOrders:
    bchw = 1
    bhwc = 3


@NodeFactory.register("chainner:onnx:load_model")
class OnnxLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            """Load ONNX model file (.onnx). Theoretically supports any ONNX model."""
        )
        self.inputs = [OnnxFileInput()]
        self.outputs = [OnnxModelOutput(), TextOutput("Model Name")]

        self.category = ONNX
        self.name = "Load Model"
        self.icon = "ONNX"
        self.sub = "Input & Output"

        self.model = None  # Defined in run

    def run(self, path: str) -> Tuple[bytes, str]:
        """Read a pth file from the specified path and return it as a state dict
        and loaded model after finding arch config"""

        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        logger.info(f"Reading onnx model from path: {path}")
        model = onnx.load_model(path)

        model_as_string = model.SerializeToString()  # type: ignore

        basename = os.path.splitext(os.path.basename(path))[0]

        return model_as_string, basename


@NodeFactory.register("chainner:onnx:save_model")
class OnnxSaveModelNode(NodeBase):
    """ONNX Save Model node"""

    def __init__(self):
        super().__init__()
        self.description = """Save ONNX model to file (.onnx)."""
        self.inputs = [OnnxModelInput(), DirectoryInput(), TextInput("Model Name")]
        self.outputs = []
        self.category = ONNX
        self.name = "Save Model"
        self.icon = "ONNX"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, onnx_model: bytes, directory: str, model_name: str) -> None:
        full_path = f"{os.path.join(directory, model_name)}.onnx"
        logger.info(f"Writing file to path: {full_path}")
        onnx.save_model(onnx_model, full_path)


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
            TileModeDropdown(has_auto=False),
        ]
        self.outputs = [
            ImageOutput(
                "Upscaled Image",
                image_type=expression.Image(
                    channels="getUpscaleChannels(Input1.channels, int(1..), int(1..))"
                ),
            )
        ]

        self.category = ONNX
        self.name = "Upscale Image"
        self.icon = "ONNX"
        self.sub = "Processing"

    def upscale(
        self,
        img: np.ndarray,
        session: ort.InferenceSession,
        tile_mode: int,
        change_shape: bool,
    ) -> np.ndarray:
        logger.info("Upscaling image")
        is_fp16_model = session.get_inputs()[0].type == "tensor(float16)"
        img = np2nptensor(img, change_range=False)
        logger.info(img.shape)
        out, _ = onnx_auto_split_process(
            img.astype(np.float16) if is_fp16_model else img,
            session,
            max_depth=tile_mode,
            change_shape=change_shape,
        )
        logger.info(out.shape)
        out = nptensor2np(out, change_range=False, imtype=np.float32)
        del session
        logger.info("Done upscaling")
        return out

    def run(self, onnx_model: bytes, img: np.ndarray, tile_mode: int) -> np.ndarray:
        """Upscales an image with a pretrained model"""

        logger.info(f"Upscaling image...")

        session = ort.InferenceSession(
            onnx_model,
            providers=[
                "CPUExecutionProvider"
                if os.environ["device"] == "cpu"
                else "CUDAExecutionProvider"
            ],
        )

        index, in_nc = [
            (i, x)
            for i, x in enumerate(session.get_inputs()[0].shape)
            if isinstance(x, int)
        ][0]

        change_shape = index == TensorOrders.bhwc

        h, w, c = get_h_w_c(img)
        logger.debug(f"Image is {h}x{w}x{c}")

        return convenient_upscale(
            img,
            in_nc,
            lambda i: self.upscale(i, session, tile_mode, change_shape),
        )
