from __future__ import annotations

from typing import Tuple

import onnx
import onnxoptimizer
from ...categories import ONNXCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import OnnxModelInput, OnnxFpDropdown
from ...properties.outputs import NcnnModelOutput, TextOutput
from ...utils.ncnn_model import NcnnModel
from ...utils.onnx_model import OnnxModel
from ...utils.onnx_to_ncnn import Onnx2NcnnConverter


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

        # TODO Figure out if this is necessary anymore or if it imports fine without it
        # Attempt to import the NCNN save node, otherwise it would be impossible to save
        try:
            # pylint: disable=unused-import, import-outside-toplevel
            from ..ncnn.save_model import NcnnSaveNode
        except:
            pass

    def run(self, model: OnnxModel, is_fp16: int) -> Tuple[NcnnModel, str]:
        fp16 = bool(is_fp16)

        model_proto = onnx.load_model_from_string(model.bytes)
        passes = onnxoptimizer.get_fuse_and_elimination_passes()
        opt_model = onnxoptimizer.optimize(model_proto, passes)  # type: ignore

        converter = Onnx2NcnnConverter(opt_model)
        ncnn_model = converter.convert(fp16, False)

        fp_mode = "fp16" if fp16 else "fp32"

        return ncnn_model, fp_mode
