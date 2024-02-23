from __future__ import annotations

import os
from pathlib import Path

from sanic.log import logger
from spandrel import ModelDescriptor, ModelLoader

from api import NodeContext
from nodes.properties.inputs import PthFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, ModelOutput
from nodes.utils.utils import split_file_path

from ...settings import get_settings
from .. import io_group


def parse_ckpt_state_dict(checkpoint: dict):
    state_dict = {}
    for i, j in checkpoint.items():
        if "netG." in i:
            key = i.replace("netG.", "")
            state_dict[key] = j
        elif "module." in i:
            key = i.replace("module.", "")
            state_dict[key] = j
    return state_dict


@io_group.register(
    schema_id="chainner:pytorch:load_model",
    name="加载模型",
    description=[
        (
            "将 PyTorch 状态字典 (.pth)、TorchScript (.pt) 或检查点 (.ckpt) 文件加载到自动检测到的支持的模型架构中。"
        ),
        (
            "- 对于超分辨率，我们支持大多数变体的 RRDB 架构（ESRGAN、Real-ESRGAN、RealSR、BSRGAN、SPSR）、Real-ESRGAN 的 SRVGG 架构、Swift-SRGAN、SwinIR、Swin2SR、HAT、Omni-SR、SRFormer 和 DAT。"
        ),
        (
            "- 对于人脸修复，我们支持 GFPGAN（1.2、1.3、1.4）、RestoreFormer 和 CodeFormer。"
        ),
        "- 对于修复，我们支持 LaMa 和 MAT。",
        (
            "官方模型的链接可以在 [chaiNNer 的 README](https://github.com/chaiNNer-org/chaiNNer#pytorch) 中找到，"
            "社区训练的模型可以在 [OpenModelDB](https://openmodeldb.info/) 上找到。"
        ),
    ],
    icon="PyTorch",
    inputs=[PthFileInput(primary_input=True)],
    outputs=[
        ModelOutput(kind="tagged"),
        DirectoryOutput("目录", of_input=0).with_id(2),
        FileNameOutput("名称", of_input=0).with_id(1),
    ],
    node_context=True,
    see_also=[
        "chainner:pytorch:load_models",
    ],
)
def load_model_node(
    context: NodeContext, path: Path
) -> tuple[ModelDescriptor, Path, str]:
    assert os.path.exists(path), f"位置 {path} 处的模型文件不存在"

    assert os.path.isfile(path), f"路径 {path} 不是文件"

    exec_options = get_settings(context)
    pytorch_device = exec_options.device

    try:
        logger.debug(f"从路径读取状态字典： {path}")

        model_descriptor = ModelLoader(pytorch_device).load_from_file(path)

        for _, v in model_descriptor.model.named_parameters():
            v.requires_grad = False
        model_descriptor.model.eval()
        model_descriptor = model_descriptor.to(pytorch_device)
        should_use_fp16 = exec_options.use_fp16 and model_descriptor.supports_half
        if should_use_fp16:
            model_descriptor.model.half()
        else:
            model_descriptor.model.float()
    except Exception as e:
        raise ValueError(
            f"chaiNNer 不支持模型 {os.path.basename(path)}。请尝试另一个"
        ) from e

    dirname, basename, _ = split_file_path(path)
    return model_descriptor, dirname, basename
