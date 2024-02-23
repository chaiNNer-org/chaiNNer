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
    name="转换为 NCNN",
    description=[
        "将 ONNX 模型转换为 NCNN。",
        "建议将转换后的模型保存为一个单独的步骤，然后在运行链时加载转换后的模型，而不是每次都进行转换。",
        "注意：转换后的模型不能保证与支持 NCNN 模型的其他程序兼容。这是由于多种原因，无法更改。",
    ],
    icon="NCNN",
    inputs=[OnnxModelInput("ONNX 模型"), OnnxFpDropdown()],
    outputs=[
        NcnnModelOutput(label="NCNN 模型"),
        TextOutput("FP 模式", "FpMode::toString(Input1)"),
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
