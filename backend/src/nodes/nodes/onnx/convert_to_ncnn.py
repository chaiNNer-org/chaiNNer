from __future__ import annotations

from typing import Tuple

import onnx
import onnxoptimizer
from . import category as ONNXCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import OnnxModelInput, OnnxFpDropdown
from ...properties.outputs import NcnnModelOutput, TextOutput
from ...impl.ncnn.ncnn_model import NcnnModelWrapper
from ...impl.onnx.onnx_model import OnnxModel
from ...impl.onnx.onnx_to_ncnn import Onnx2NcnnConverter

FP_MODE_32 = 0


@NodeFactory.register("chainner:onnx:convert_to_ncnn")
class ConvertOnnxToNcnnNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Convert an ONNX model to NCNN."""
        self.inputs = [OnnxModelInput("ONNX Model"), OnnxFpDropdown()]
        self.outputs = [
            NcnnModelOutput(label="NCNN Model"),
            TextOutput("FP Mode", "FpMode::toString(Input1)"),
        ]

        self.category = ONNXCategory
        self.name = "Convert To NCNN"
        self.icon = "NCNN"
        self.sub = "Utility"

    def run(self, model: OnnxModel, is_fp16: int) -> Tuple[NcnnModelWrapper, str]:
        fp16 = bool(is_fp16)

        model_proto = onnx.load_model_from_string(model.bytes)
        passes = onnxoptimizer.get_fuse_and_elimination_passes()
        opt_model = onnxoptimizer.optimize(model_proto, passes)

        converter = Onnx2NcnnConverter(opt_model)
        ncnn_model = NcnnModelWrapper(converter.convert(fp16, False))

        fp_mode = "fp16" if fp16 else "fp32"

        return ncnn_model, fp_mode
