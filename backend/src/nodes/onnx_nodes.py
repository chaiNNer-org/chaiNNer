from __future__ import annotations

import os
from copy import deepcopy
from typing import Tuple

import numpy as np
import onnx
import onnxoptimizer
import onnxruntime as ort
from google.protobuf.internal.containers import RepeatedCompositeFieldContainer
from onnx import numpy_helper as onph
from sanic.log import logger

from .categories import ONNXCategory
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.ncnn_model import NcnnModel
from .utils.onnx_auto_split import onnx_auto_split_process
from .utils.onnx_to_ncnn import Onnx2NcnnConverter
from .utils.utils import get_h_w_c, np2nptensor, nptensor2np, convenient_upscale
from .utils.exec_options import get_execution_options


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
        self.outputs = [
            OnnxModelOutput(),
            DirectoryOutput("Model Directory").with_id(2),
            TextOutput("Model Name").with_id(1),
        ]

        self.category = ONNXCategory
        self.name = "Load Model"
        self.icon = "ONNX"
        self.sub = "Input & Output"

        self.model = None  # Defined in run

    def run(self, path: str) -> Tuple[bytes, str, str]:
        """Read a pth file from the specified path and return it as a state dict
        and loaded model after finding arch config"""

        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        logger.info(f"Reading onnx model from path: {path}")
        model = onnx.load_model(path)

        model_as_string = model.SerializeToString()  # type: ignore

        dirname, basename = os.path.split(os.path.splitext(path)[0])
        return model_as_string, dirname, basename


@NodeFactory.register("chainner:onnx:save_model")
class OnnxSaveModelNode(NodeBase):
    """ONNX Save Model node"""

    def __init__(self):
        super().__init__()
        self.description = """Save ONNX model to file (.onnx)."""
        self.inputs = [
            OnnxModelInput(),
            DirectoryInput(has_handle=True),
            TextInput("Model Name"),
        ]
        self.outputs = []
        self.category = ONNXCategory
        self.name = "Save Model"
        self.icon = "MdSave"
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
        tile_mode: Union[int, None],
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

    def run(
        self, onnx_model: bytes, img: np.ndarray, tile_mode: Union[int, None]
    ) -> np.ndarray:
        """Upscales an image with a pretrained model"""

        logger.info(f"Upscaling image...")

        session = ort.InferenceSession(
            onnx_model,
            providers=[
                "CPUExecutionProvider"
                if get_execution_options().device == "cpu"
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


@NodeFactory.register("chainner:onnx:interpolate_models")
class OnnxInterpolateModelsNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Interpolate two NCNN models of the same type together. \
            Note: models must share a common 'pretrained model' ancestor \
            in order to be interpolatable."
        self.inputs = [
            OnnxModelInput("Model A"),
            OnnxModelInput("Model B"),
            SliderInput(
                "Weights",
                controls_step=5,
                slider_step=1,
                maximum=100,
                default=50,
                unit="%",
                note_expression="`Model A ${100 - value}% ― Model B ${value}%`",
                ends=("A", "B"),
            ),
        ]
        self.outputs = [
            OnnxModelOutput(),
            NumberOutput("Amount A", "subtract(100, Input2)"),
            NumberOutput("Amount B", "Input2"),
        ]

        self.category = ONNXCategory
        self.name = "Interpolate Models"
        self.icon = "BsTornado"
        self.sub = "Utility"

    @staticmethod
    def perform_interp(
        model_a_weights: RepeatedCompositeFieldContainer,
        model_b_weights: RepeatedCompositeFieldContainer,
        amount: float,
    ) -> List[onnx.TensorProto]:
        amount_b = amount / 100
        amount_a = 1 - amount_b

        interp_weights_list = []
        for weight_a, weight_b in zip(model_a_weights, model_b_weights):
            weight_name = weight_b.name
            weight_array_a = onph.to_array(weight_a)
            weight_array_b = onph.to_array(weight_b)

            assert (
                weight_array_a.shape == weight_array_b.shape
            ), "Weights must have same size and shape"

            weight_array_interp = (
                weight_array_a * amount_a + weight_array_b * amount_b
            ).astype(weight_array_a.dtype)
            weight_interp = onph.from_array(weight_array_interp, weight_name)
            interp_weights_list.append(weight_interp)

        return interp_weights_list

    def check_will_upscale(self, interp: bytes):
        fake_img = np.ones((3, 3, 3), dtype=np.float32, order="F")
        result = OnnxImageUpscaleNode().run(interp, fake_img, None)

        mean_color = np.mean(result)
        del result
        return mean_color > 0.5

    def run(
        self, model_a: bytes, model_b: bytes, amount: int
    ) -> Tuple[bytes, int, int]:
        if amount == 0:
            return model_a, 100, 0
        elif amount == 100:
            return model_b, 0, 100

        # Just to be sure there is no mismatch from opt/un-opt models
        passes = onnxoptimizer.get_fuse_and_elimination_passes()

        model_proto_a = onnx.load_from_string(model_a)  # type:ignore
        model_proto_a = onnxoptimizer.optimize(model_proto_a, passes)
        model_a_weights = model_proto_a.graph.initializer  # type: ignore

        model_proto_b = onnx.load_from_string(model_b)  # type:ignore
        model_proto_b = onnxoptimizer.optimize(model_proto_b, passes)
        model_b_weights = model_proto_b.graph.initializer  # type: ignore

        assert len(model_a_weights) == len(
            model_b_weights
        ), "Models must have same number of weights"

        logger.info(f"Interpolating models...")
        interp_weights_list = self.perform_interp(
            model_a_weights, model_b_weights, amount
        )

        model_proto_interp = deepcopy(model_proto_b)
        for _ in range(len(model_proto_interp.graph.initializer)):  # type: ignore
            # Assigning a new value or assigning to field index do not seem to work
            model_proto_interp.graph.initializer.pop()  # type: ignore
        model_proto_interp.graph.initializer.extend(interp_weights_list)  # type: ignore
        model_interp = model_proto_interp.SerializeToString()  # type: ignore

        if not self.check_will_upscale(model_interp):
            raise ValueError(
                "These models are not compatible and not able to be interpolated together"
            )

        return model_interp, 100 - amount, amount


@NodeFactory.register("chainner:onnx:convert_to_ncnn")
class ConvertOnnxToNcnnNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Convert an ONNX model to NCNN."""
        self.inputs = [OnnxModelInput("ONNX Model"), OnnxFpDropdown()]
        self.outputs = [
            NcnnModelOutput("NCNN Model"),
            TextOutput(
                "FP Mode",
                """match Input1 {
                        FpMode::fp32 => "fp32",
                        FpMode::fp16 => "fp16",
                }""",
            ),
        ]

        self.category = ONNXCategory
        self.name = "Convert To NCNN"
        self.icon = "NCNN"
        self.sub = "Utility"

    def run(self, onnx_model: bytes, is_fp16: int) -> Tuple[NcnnModel, str]:
        fp16 = bool(is_fp16)

        model_proto = onnx.load_model_from_string(onnx_model)
        passes = onnxoptimizer.get_fuse_and_elimination_passes()
        opt_model = onnxoptimizer.optimize(model_proto, passes)  # type: ignore

        converter = Onnx2NcnnConverter(opt_model)
        ncnn_model = converter.convert(fp16, False)

        fp_mode = "fp16" if fp16 else "fp32"

        return ncnn_model, fp_mode
