import os
from typing import Any, OrderedDict

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
from .utils.utils import get_h_w_c


@NodeFactory.register("chainner:onnx:load_model")
class OnnxLoadModelNode(NodeBase):
    """ONNX Load Model node"""

    def __init__(self):
        """Constructor"""
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

    def run(self, path: str) -> Any:
        """Read a pth file from the specified path and return it as a state dict
        and loaded model after finding arch config"""

        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        logger.info(f"Reading onnx model from path: {path}")
        model = onnx.load_model(path)

        basename = os.path.splitext(os.path.basename(path))[0]

        return model, basename


@NodeFactory.register("chainner:onnx:upscale_image")
class OnnxImageUpscaleNode(NodeBase):
    """Image Upscale node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Upscales an image using an ONNX Super-Resolution model."
        self.inputs = [OnnxModelInput(), ImageInput()]
        self.outputs = [ImageOutput("Upscaled Image")]

        self.category = ONNX
        self.name = "Upscale Image"
        self.icon = "ONNX"
        self.sub = "Processing"

    def upscale(self, img: np.ndarray, model: onnx.ModelProto):
        with torch.no_grad():
            logger.info("Upscaling image")
            session = ort.InferenceSession(
                model,
                providers=[
                    "CPUExecutionProvider"
                    if os.environ["device"] == "cpu"
                    else "CUDAExecutionProvider"
                ],
            )
            out, _ = onnx_auto_split_process(img, session)
            del session
            logger.info("Done upscaling")
            return out

    def run(self, model: onnx.ModelProto, img: np.ndarray) -> np.ndarray:
        """Upscales an image with a pretrained model"""

        logger.info(f"Upscaling image...")

        # Assume in_nc is 3
        in_nc = 3
        _, _, c = get_h_w_c(img)

        # Ensure correct amount of image channels for the model.
        # The frontend should type-validate this enough where it shouldn't be needed,
        # But I want to be extra safe

        # Transparency hack (white/black background difference alpha)
        if in_nc == 3 and c == 4:
            # Ignore single-color alpha
            unique = np.unique(img[:, :, 3])
            if len(unique) == 1:
                logger.info("Single color alpha channel, ignoring.")
                output = self.upscale(img[:, :, :3], model)  # type: ignore
                output = np.dstack((output, np.full(output.shape[:-1], unique[0])))
            else:
                img1 = np.copy(img[:, :, :3])
                img2 = np.copy(img[:, :, :3])
                for c in range(3):
                    img1[:, :, c] *= img[:, :, 3]
                    img2[:, :, c] = (img2[:, :, c] - 1) * img[:, :, 3] + 1

                output1 = self.upscale(img1, model)  # type: ignore
                output2 = self.upscale(img2, model)  # type: ignore
                alpha = 1 - np.mean(output2 - output1, axis=2)  # type: ignore
                output = np.dstack((output1, alpha))
        else:
            # Add extra channels if not enough (i.e single channel img, three channel model)
            gray = False
            if img.ndim == 2:
                gray = True
                logger.debug("Expanding image channels")
                img = np.tile(np.expand_dims(img, axis=2), (1, 1, min(in_nc, 3)))  # type: ignore
            # Remove extra channels if too many (i.e three channel image, single channel model)
            elif img.shape[2] > in_nc:  # type: ignore
                logger.warning("Truncating image channels")
                img = img[:, :, :in_nc]
            # Pad with solid alpha channel if needed (i.e three channel image, four channel model)
            elif img.shape[2] == 3 and in_nc == 4:
                logger.debug("Expanding image channels")
                img = np.dstack((img, np.full(img.shape[:-1], 1.0)))

            output = self.upscale(img, model)  # type: ignore

            if gray:
                output = np.average(output, axis=2).astype("float32")

        output = np.clip(output, 0, 1)

        return output
