from __future__ import annotations

from enum import Enum

import numpy as np
import torch
from spandrel import ImageModelDescriptor

from api import NodeContext
from nodes.impl.onnx.load import load_onnx_model
from nodes.impl.onnx.model import OnnxGeneric
from nodes.impl.pytorch.convert_to_onnx_impl import (
    convert_to_onnx_impl,
    is_onnx_supported,
)
from nodes.properties.inputs import BoolInput, EnumInput, OnnxFpDropdown, SrModelInput
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
        BoolInput("Verify", default=False).with_docs(
            "Runs the ONNX and PyTorch models to verify that they produce the same output. It's recommended to keep this on to ensure the conversion is correct.",
            "Verification requires ONNX to be installed.",
            hint=True,
        ),
    ],
    outputs=[
        OnnxModelOutput(
            model_type="OnnxGenericModel & pytorchToOnnx(Input0)",
            label="ONNX Model",
        ),
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
    context: NodeContext,
    model: ImageModelDescriptor,
    is_fp16: int,
    opset: Opset,
    verify: bool,
) -> tuple[OnnxGeneric, str, str]:
    assert is_onnx_supported(model), (
        f"{model.architecture} is not supported for ONNX conversion at this time."
    )

    fp16 = bool(is_fp16)
    exec_options = get_settings(context)
    device = exec_options.device
    if fp16:
        if not exec_options.use_fp16:
            raise ValueError(
                "PyTorch fp16 mode must be supported and turned on in settings to convert model as fp16."
            )
        if not model.supports_half:
            raise ValueError(
                f"This {model.architecture.name} model does not support FP16. Please convert as FP32."
            )

    model.eval().to(device)

    onnx_model_bytes = convert_to_onnx_impl(
        model,
        device,
        use_half=fp16,
        opset_version=opset.value,
    )
    onnx_model = load_onnx_model(onnx_model_bytes)
    assert onnx_model.sub_type == "Generic"

    if verify:
        verify_models(model, onnx_model_bytes, fp16)

    fp_mode = "fp16" if fp16 else "fp32"

    return onnx_model, fp_mode, f"opset{opset.value}"


def verify_models(pytorch_model: ImageModelDescriptor, onnx_model: bytes, fp16: bool):
    # based on: https://github.com/muslll/neosr/blob/d871e468fa9e82dc874f65b2289ad5726a5ab3b9/convert.py#L61
    import onnxruntime as ort

    dummy_size = 16
    dummy_size += pytorch_model.size_requirements.get_padding(dummy_size, dummy_size)[0]
    dummy_input = torch.rand(
        1,
        pytorch_model.input_channels,
        dummy_size,
        dummy_size,
        device=pytorch_model.device,
        dtype=pytorch_model.dtype,
    )

    # pytorch
    torch_out = pytorch_model(dummy_input).detach().cpu().numpy()

    # onnx
    session = ort.InferenceSession(onnx_model, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    onnx_out = np.asarray(
        session.run(
            [output_name],
            {input_name: dummy_input.detach().cpu().numpy()},
        )[0]
    )

    np.testing.assert_allclose(torch_out, onnx_out, rtol=0.01, atol=0.001)
