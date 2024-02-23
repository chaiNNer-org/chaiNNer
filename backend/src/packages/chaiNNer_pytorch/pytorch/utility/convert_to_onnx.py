from __future__ import annotations

from enum import Enum

from spandrel import ImageModelDescriptor

from api import NodeContext
from nodes.impl.onnx.model import OnnxGeneric
from nodes.impl.pytorch.convert_to_onnx_impl import (
    convert_to_onnx_impl,
    is_onnx_supported,
)
from nodes.properties.inputs import EnumInput, OnnxFpDropdown, SrModelInput
from nodes.properties.outputs import OnnxModelOutput, TextOutput

from ...settings import get_settings
from .. import utility_group


class Opset(Enum):
    OPSET_14 = 14
    OPSET_15 = 15
    OPSET_16 = 16
    OPSET_17 = 17


OPSET_LABELS: dict[Opset, str] = {
    Opset.OPSET_14: "14",
    Opset.OPSET_15: "15",
    Opset.OPSET_16: "16",
    Opset.OPSET_17: "17",
}


@utility_group.register(
    schema_id="chainner:pytorch:convert_to_onnx",
    name="转换为 ONNX",
    description=[
        "将 PyTorch 模型转换为 ONNX。注意：只有在 PyTorch 中打开 fp16 模式时，fp16 转换才能正常工作。",
        "建议将转换后的模型保存为单独的步骤，然后在运行链时加载转换后的模型，而不是每次运行链时都进行转换。",
        "注意：转换后的模型不能保证与支持 ONNX 模型的其他程序兼容。这是由于多种原因，无法更改。",
    ],
    icon="ONNX",
    inputs=[
        SrModelInput("PyTorch 模型"),
        OnnxFpDropdown(),
        EnumInput(
            Opset,
            label="Opset",
            default=Opset.OPSET_14,
            option_labels=OPSET_LABELS,
        ),
    ],
    outputs=[
        OnnxModelOutput(model_type="OnnxGenericModel", label="ONNX 模型"),
        TextOutput("FP 模式", "FpMode::toString(Input1)"),
        TextOutput(
            "Opset",
            """
                let opset = Input2;
                match opset {
                    Opset::Opset14 => "opset14",
                    Opset::Opset15 => "opset15",
                    Opset::Opset16 => "opset16",
                    Opset::Opset17 => "opset17",
                }
            """,
        ),
    ],
    node_context=True,
)
def convert_to_onnx_node(
    context: NodeContext, model: ImageModelDescriptor, is_fp16: int, opset: Opset
) -> tuple[OnnxGeneric, str, str]:
    assert is_onnx_supported(
        model
    ), f"目前不支持将 {model.architecture} 转换为 ONNX。"

    fp16 = bool(is_fp16)
    exec_options = get_settings(context)
    device = exec_options.device
    if fp16:
        assert exec_options.use_fp16, "必须在设置中支持并打开 PyTorch 的 fp16 模式才能将模型转换为 fp16。"

    model.eval().to(device)

    use_half = fp16 and model.supports_half

    onnx_model_bytes = convert_to_onnx_impl(
        model,
        device,
        use_half,
        opset_version=opset.value,
    )

    fp_mode = "fp16" if use_half else "fp32"

    return OnnxGeneric(onnx_model_bytes), fp_mode, f"opset{opset.value}"
