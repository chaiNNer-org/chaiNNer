from __future__ import annotations

from typing import Any

from . import category as PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ModelInput, OnnxFpDropdown
from ...properties.outputs import NcnnModelOutput, TextOutput
from ...utils.torch_types import PyTorchModel

from .convert_to_onnx import ConvertTorchToONNXNode

try:
    from ..onnx.convert_to_ncnn import ConvertOnnxToNcnnNode
except:
    ConvertOnnxToNcnnNode = None


@NodeFactory.register("chainner:pytorch:convert_to_ncnn")
class ConvertTorchToNCNNNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Convert a PyTorch model to NCNN. Internally, this node uses ONNX as an intermediate format."""
        self.inputs = [
            ModelInput(
                "PyTorch Model",
                input_type="PyTorchModel { arch: invStrSet(PyTorchModel::FaceArchs) }",
            ),
            OnnxFpDropdown(),
        ]
        self.outputs = [
            NcnnModelOutput(label="NCNN Model"),
            TextOutput(
                "FP Mode",
                """match Input1 {
                        FpMode::fp32 => "fp32",
                        FpMode::fp16 => "fp16",
                }""",
            ),
        ]

        self.category = PyTorchCategory
        self.name = "Convert To NCNN"
        self.icon = "NCNN"
        self.sub = "Utility"

    def run(self, model: PyTorchModel, is_fp16: int) -> Any:
        if ConvertOnnxToNcnnNode is None:
            raise Exception(
                "Converting to NCNN is done through ONNX as an intermediate format (PyTorch -> ONNX -> NCNN), \
                and therefore requires the ONNX dependency to be installed. Please install ONNX through the dependency \
                manager to use this node."
            )
        onnx_model = ConvertTorchToONNXNode().run(model)
        ncnn_model, fp_mode = ConvertOnnxToNcnnNode().run(onnx_model, is_fp16)

        return ncnn_model, fp_mode
