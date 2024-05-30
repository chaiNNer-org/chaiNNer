from __future__ import annotations

from sanic.log import logger
from spandrel import ImageModelDescriptor
from spandrel.architectures.DAT import DAT
from spandrel.architectures.HAT import HAT
from spandrel.architectures.OmniSR import OmniSR
from spandrel.architectures.SCUNet import SCUNet
from spandrel.architectures.SPAN import SPAN
from spandrel.architectures.Swin2SR import Swin2SR
from spandrel.architectures.SwinIR import SwinIR
from spandrel_extra_arches.architectures.SRFormer import SRFormer

from api import NodeContext
from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.properties.inputs import OnnxFpDropdown, SrModelInput
from nodes.properties.outputs import NcnnModelOutput, TextOutput

from ...settings import get_settings
from .. import utility_group


@utility_group.register(
    schema_id="chainner:pytorch:convert_to_ncnn",
    name="Convert To NCNN",
    description=[
        "Convert a PyTorch model to NCNN. Internally, this node uses ONNX as an intermediate format, so the ONNX dependency must also be installed to use this node.",
        "It is recommended to save converted models as a separate step, then load the converted models instead of converting them every time you run the chain.",
        "Note: Converted models are not guaranteed to work with other programs that support NCNN models. This is for a variety of reasons and cannot be changed.",
    ],
    icon="NCNN",
    inputs=[
        SrModelInput("PyTorch Model"),
        OnnxFpDropdown(),
    ],
    outputs=[
        NcnnModelOutput(label="NCNN Model"),
        TextOutput("FP Mode", "FpMode::toString(Input1)"),
    ],
    node_context=True,
)
def convert_to_ncnn_node(
    context: NodeContext, model: ImageModelDescriptor, is_fp16: int
) -> tuple[NcnnModelWrapper, str]:
    try:
        from nodes.impl.onnx.load import load_onnx_model
        from nodes.impl.pytorch.convert_to_onnx_impl import (
            convert_to_onnx_impl,
            is_onnx_supported,
        )

        from ....chaiNNer_onnx.onnx.utility.convert_to_ncnn import (
            convert_to_ncnn_node as onnx_convert_to_ncnn_node,
        )
    except Exception as e:
        logger.error(e)
        raise ModuleNotFoundError(  # noqa: B904
            "Converting to NCNN is done through ONNX as an intermediate format (PyTorch -> ONNX -> NCNN), \
                and therefore requires the ONNX dependency to be installed. Please install ONNX through the dependency \
                manager to use this node."
        )

    assert is_onnx_supported(model) and not isinstance(
        model.model, (HAT, DAT, OmniSR, SwinIR, Swin2SR, SCUNet, SPAN, SRFormer)
    ), f"{model.architecture.name} is not supported for NCNN conversions at this time."

    exec_options = get_settings(context)
    device = exec_options.device

    # Intermediate conversion to ONNX is always fp32
    onnx_model = load_onnx_model(
        convert_to_onnx_impl(model, device, False, "data", "output")
    )
    ncnn_model, fp_mode = onnx_convert_to_ncnn_node(onnx_model, is_fp16)

    return ncnn_model, fp_mode
