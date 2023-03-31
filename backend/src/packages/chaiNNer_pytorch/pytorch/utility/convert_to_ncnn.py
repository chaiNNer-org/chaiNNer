from __future__ import annotations

from typing import Any

from nodes.impl.pytorch.architecture.Swin2SR import Swin2SR
from nodes.impl.pytorch.architecture.SwinIR import SwinIR
from nodes.impl.pytorch.types import PyTorchSRModel
from nodes.properties.inputs import OnnxFpDropdown, SrModelInput
from nodes.properties.outputs import NcnnModelOutput, TextOutput

from .. import utility_group
from .convert_to_onnx import ConvertTorchToONNXNode

try:
    from ...chaiNNer_onnx.onnx.convert_to_ncnn import FP_MODE_32, ConvertOnnxToNcnnNode
except:
    ConvertOnnxToNcnnNode = None


@utility_group.register(
    schema_id="chainner:pytorch:convert_to_ncnn",
    name="Convert To NCNN",
    description="""Convert a PyTorch model to NCNN. Internally, this node uses ONNX as an intermediate format.""",
    icon="NCNN",
    inputs=[
        SrModelInput("PyTorch Model"),
        OnnxFpDropdown(),
    ],
    outputs=[
        NcnnModelOutput(label="NCNN Model"),
        TextOutput("FP Mode", "FpMode::toString(Input1)"),
    ],
)
def convert_to_ncnn_node(model: PyTorchSRModel, is_fp16: int) -> Any:
    if ConvertOnnxToNcnnNode is None:
        raise ModuleNotFoundError(
            "Converting to NCNN is done through ONNX as an intermediate format (PyTorch -> ONNX -> NCNN), \
                and therefore requires the ONNX dependency to be installed. Please install ONNX through the dependency \
                manager to use this node."
        )

    assert not isinstance(
        model, SwinIR
    ), "SwinIR is not supported for NCNN conversion at this time."

    assert not isinstance(
        model, Swin2SR
    ), "Swin2SR is not supported for NCNN conversion at this time."

    # Intermediate conversion to ONNX is always fp32
    onnx_model = ConvertTorchToONNXNode().run(model, FP_MODE_32)[0]
    ncnn_model, fp_mode = ConvertOnnxToNcnnNode().run(onnx_model, is_fp16)

    return ncnn_model, fp_mode
