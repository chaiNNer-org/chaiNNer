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
from .utils.utils import get_h_w_c, np2nptensor, nptensor2np


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

    def run(self, path: str) -> Tuple[ort.InferenceSession, str]:
        """Read a pth file from the specified path and return it as a state dict
        and loaded model after finding arch config"""

        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        logger.info(f"Reading onnx model from path: {path}")
        model = onnx.load_model(path)

        model_as_string = model.SerializeToString()  # type: ignore

        session = ort.InferenceSession(
            model_as_string,
            providers=[
                "CPUExecutionProvider"
                if os.environ["device"] == "cpu"
                else "CUDAExecutionProvider"
            ],
        )

        basename = os.path.splitext(os.path.basename(path))[0]

        return session, basename


@NodeFactory.register("chainner:onnx:upscale_image")
class OnnxImageUpscaleNode(NodeBase):
    """Image Upscale node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Upscales an image using an ONNX Super-Resolution model. \
            ONNX does not support automatic out-of-memory handling via automatic tiling. \
            Therefore, you must set a split factor yourself. If you get an out-of-memory error, increase this number by 1."
        self.inputs = [
            OnnxModelInput(),
            ImageInput(),
            NumberInput("Split Factor", default=1, minimum=1, maximum=10),
        ]
        self.outputs = [ImageOutput("Upscaled Image")]

        self.category = ONNX
        self.name = "Upscale Image"
        self.icon = "ONNX"
        self.sub = "Processing"

    def upscale(
        self, img: np.ndarray, session: ort.InferenceSession, split_factor: int
    ) -> np.ndarray:
        logger.info("Upscaling image")
        is_fp16_model = session.get_inputs()[0].type == "tensor(float16)"
        img = np2nptensor(img, change_range=False)
        out, _ = onnx_auto_split_process(
            img.astype(np.float16) if is_fp16_model else img,
            session,
            max_depth=split_factor,
        )
        out = nptensor2np(out, change_range=False, imtype=np.float32)
        del session
        logger.info("Done upscaling")
        return out

    def run(
        self, session: ort.InferenceSession, img: np.ndarray, split_factor: int
    ) -> np.ndarray:
        """Upscales an image with a pretrained model"""

        logger.info(f"Upscaling image...")

        in_nc = session.get_inputs()[0].shape[1]

        _, _, c = get_h_w_c(img)
        logger.info(f"Image has {c} channels")

        # Ensure correct amount of image channels for the model.
        # The frontend should type-validate this enough where it shouldn't be needed,
        # But I want to be extra safe

        # Transparency hack (white/black background difference alpha)
        if in_nc == 3 and c == 4:
            # Ignore single-color alpha
            unique = np.unique(img[:, :, 3])
            if len(unique) == 1:
                logger.info("Single color alpha channel, ignoring.")
                output = self.upscale(img[:, :, :3], session, split_factor)  # type: ignore
                output = np.dstack((output, np.full(output.shape[:-1], unique[0])))
            else:
                img1 = np.copy(img[:, :, :3])
                img2 = np.copy(img[:, :, :3])
                for c in range(3):
                    img1[:, :, c] *= img[:, :, 3]
                    img2[:, :, c] = (img2[:, :, c] - 1) * img[:, :, 3] + 1

                output1 = self.upscale(img1, session, split_factor)  # type: ignore
                output2 = self.upscale(img2, session, split_factor)  # type: ignore
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

            output = self.upscale(img, session, split_factor)  # type: ignore

            if gray:
                output = np.average(output, axis=2).astype("float32")

        output = np.clip(output, 0, 1)

        return output


# TODO: No point of this node for now
# @NodeFactory.register("chainner:onnx:save_model")
# class OnnxSaveNode(NodeBase):
#     """Model Save node"""

#     def __init__(self):
#         """Constructor"""
#         super().__init__()
#         self.description = "Save an ONNX model to specified directory."
#         self.inputs = [OnnxModelInput(), DirectoryInput(), TextInput("Model Name")]
#         self.outputs = []

#         self.category = ONNX
#         self.name = "Save Model"
#         self.icon = "MdSave"
#         self.sub = "Input & Output"

#     def run(self, model: onnx.ModelProto, directory: str, name: str) -> None:
#         full_file = f"{name}.onnx"
#         full_path = os.path.join(directory, full_file)
#         logger.info(f"Writing model to path: {full_path}")
#         onnx.save_model(model, full_path)
