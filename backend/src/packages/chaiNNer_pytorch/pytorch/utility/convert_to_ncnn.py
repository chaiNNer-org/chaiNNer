from __future__ import annotations

from spandrel import ImageModelDescriptor
from spandrel.architectures.DAT import DAT
from spandrel.architectures.HAT import HAT
from spandrel.architectures.OmniSR import OmniSR
from spandrel.architectures.SCUNet import SCUNet
from spandrel.architectures.SRFormer import SRFormer
from spandrel.architectures.Swin2SR import Swin2SR
from spandrel.architectures.SwinIR import SwinIR

from api import NodeContext
from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.impl.onnx.model import OnnxGeneric
from nodes.impl.pytorch.convert_to_onnx_impl import (
    convert_to_onnx_impl,
    is_onnx_supported,
)
from nodes.properties.inputs import OnnxFpDropdown, SrModelInput
from nodes.properties.outputs import NcnnModelOutput, TextOutput

from ...settings import get_settings
from .. import utility_group

try:
    from ....chaiNNer_onnx.onnx.utility.convert_to_ncnn import (
        convert_to_ncnn_node as onnx_convert_to_ncnn_node,
    )
except Exception:
    onnx_convert_to_ncnn_node = None


@utility_group.register(
    schema_id="chainner:pytorch:convert_to_ncnn",
    name="转换为 NCNN",
    description=[
        "将 PyTorch 模型转换为 NCNN。在内部，此节点使用 ONNX 作为中间格式，因此必须安装 ONNX 依赖才能使用此节点。",
        "建议将转换后的模型保存为单独的步骤，然后在运行链时加载转换后的模型，而不是每次运行链时都进行转换。",
        "注意：转换后的模型不能保证与支持 NCNN 模型的其他程序兼容。这是由于多种原因，无法更改。",
    ],
    icon="NCNN",
    inputs=[
        SrModelInput("PyTorch 模型"),
        OnnxFpDropdown(),
    ],
    outputs=[
        NcnnModelOutput(label="NCNN 模型"),
        TextOutput("FP 模式", "FpMode::toString(Input1)"),
    ],
    node_context=True,
)
def convert_to_ncnn_node(
    context: NodeContext, model: ImageModelDescriptor, is_fp16: int
) -> tuple[NcnnModelWrapper, str]:
    if onnx_convert_to_ncnn_node is None:
        raise ModuleNotFoundError(
            "将模型转换为 NCNN 是通过 ONNX 作为中间格式完成的（PyTorch -> ONNX -> NCNN），\
                因此需要安装 ONNX 依赖。请通过依赖管理器安装 ONNX 以使用此节点。"
        )

    assert is_onnx_supported(model) and not isinstance(
        model.model, (HAT, DAT, OmniSR, SwinIR, Swin2SR, SCUNet, SRFormer)
    ), f"目前不支持将 {model.architecture} 转换为 NCNN。"

    exec_options = get_settings(context)
    device = exec_options.device

    # 中间转换到 ONNX 时始终使用 fp32
    onnx_model = OnnxGeneric(
        convert_to_onnx_impl(model, device, False, "data", "output")
    )
    ncnn_model, fp_mode = onnx_convert_to_ncnn_node(onnx_model, is_fp16)

    return ncnn_model, fp_mode
