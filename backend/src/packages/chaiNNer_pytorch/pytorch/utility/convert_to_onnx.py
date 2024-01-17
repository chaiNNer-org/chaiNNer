from __future__ import annotations

from enum import Enum

from spandrel import ImageModelDescriptor
from spandrel.architectures.SCUNet import SCUNet

from api import NodeContext
from nodes.impl.onnx.model import OnnxGeneric
from nodes.impl.pytorch.convert_to_onnx_impl import convert_to_onnx_impl
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
    name="Convert To ONNX",
    description=[
        "Convert a PyTorch model to ONNX. Note: fp16 conversion will only work if PyTorch fp16 mode is turned on.",
        "It is recommended to save converted models as a separate step, then load the converted models instead of converting them every time you run the chain.",
        "Note: Converted models are not guaranteed to work with other programs that support ONNX models. This is for a variety of reasons and cannot be changed.",
    ],
    icon="ONNX",
    inputs=[
        SrModelInput("PyTorch Model"),
        OnnxFpDropdown(),
        EnumInput(
            Opset,
            label="Opset",
            default=Opset.OPSET_14,
            option_labels=OPSET_LABELS,
        ),
    ],
    outputs=[
        OnnxModelOutput(model_type="OnnxGenericModel", label="ONNX Model"),
        TextOutput("FP Mode", "FpMode::toString(Input1)"),
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
    if isinstance(model.model, SCUNet):
        raise ValueError("SCUNet is not supported for ONNX conversion at this time.")

    fp16 = bool(is_fp16)
    exec_options = get_settings(context)
    device = exec_options.device
    if fp16:
        if not exec_options.use_fp16:
            raise RuntimeError(
                "PyTorch fp16 mode must be supported and turned on in settings to convert model as fp16."
            )

    model.model.eval()
    model = model.to(device)

    use_half = fp16 and model.supports_half

    onnx_model_bytes = convert_to_onnx_impl(
        model,
        device,
        use_half,
        opset_version=opset.value,
    )

    fp_mode = "fp16" if use_half else "fp32"

    return OnnxGeneric(onnx_model_bytes), fp_mode, f"opset{opset.value}"
