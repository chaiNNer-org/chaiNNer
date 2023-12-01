from __future__ import annotations

from spandrel import ImageModelDescriptor
from spandrel.architectures.SCUNet import SCUNet

from nodes.impl.onnx.model import OnnxGeneric
from nodes.impl.pytorch.convert_to_onnx_impl import convert_to_onnx_impl
from nodes.properties.inputs import OnnxFpDropdown, SrModelInput
from nodes.properties.outputs import OnnxModelOutput, TextOutput

from ...settings import get_settings
from .. import utility_group


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
    ],
    outputs=[
        OnnxModelOutput(model_type="OnnxGenericModel", label="ONNX Model"),
        TextOutput("FP Mode", "FpMode::toString(Input1)"),
    ],
)
def convert_to_onnx_node(
    model: ImageModelDescriptor, is_fp16: int
) -> tuple[OnnxGeneric, str]:
    assert not isinstance(
        model.model, SCUNet
    ), "SCUNet is not supported for ONNX conversion at this time."

    fp16 = bool(is_fp16)
    exec_options = get_settings()
    device = exec_options.device
    if fp16:
        assert exec_options.use_fp16, "PyTorch fp16 mode must be supported and turned on in settings to convert model as fp16."

    model.model.eval()
    model = model.to(device)

    use_half = fp16 and model.supports_half

    onnx_model_bytes = convert_to_onnx_impl(model, device, use_half)

    fp_mode = "fp16" if use_half else "fp32"

    return OnnxGeneric(onnx_model_bytes), fp_mode
