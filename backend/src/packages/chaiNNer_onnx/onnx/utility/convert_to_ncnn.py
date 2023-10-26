from __future__ import annotations

import onnx
from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.impl.onnx.model import OnnxModel
from nodes.impl.onnx.onnx_to_ncnn import Onnx2NcnnConverter
from nodes.impl.onnx.utils import safely_optimize_onnx_model
from nodes.properties.inputs import OnnxFpDropdown, OnnxModelInput
from nodes.properties.outputs import NcnnModelOutput, TextOutput

from .. import utility_group

FP_MODE_32 = 0


@utility_group.register(
    schema_id="chainner:onnx:convert_to_ncnn",
    name="Convert To NCNN",
    description=[
        "Convert an ONNX model to NCNN.",
        "It is recommended to save converted models as a separate step, then load the converted models instead of converting them every time you run the chain.",
        "Note: Converted models are not guaranteed to work with other programs that support NCNN models. This is for a variety of reasons and cannot be changed.",
    ],
    icon="NCNN",
    inputs=[OnnxModelInput("ONNX Model"), OnnxFpDropdown()],
    outputs=[
        NcnnModelOutput(label="NCNN Model"),
        TextOutput("FP Mode", "FpMode::toString(Input1)"),
    ],
)
def convert_to_ncnn_node(
    model: OnnxModel, is_fp16: int
) -> tuple[NcnnModelWrapper, str]:
    fp16 = bool(is_fp16)

    model_proto = onnx.load_model_from_string(model.bytes)
    opt_model = safely_optimize_onnx_model(model_proto)

    converter = Onnx2NcnnConverter(opt_model)
    ncnn_model = NcnnModelWrapper(converter.convert(fp16, False))

    fp_mode = "fp16" if fp16 else "fp32"

    return ncnn_model, fp_mode
