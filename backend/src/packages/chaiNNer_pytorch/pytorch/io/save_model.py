from __future__ import annotations

from enum import Enum
from pathlib import Path

import torch
from safetensors.torch import save_file
from sanic.log import logger
from spandrel import ModelDescriptor

from nodes.properties.inputs import DirectoryInput, EnumInput, ModelInput, TextInput

from .. import io_group


class WeightFormat(Enum):
    PTH = "pth"
    ST = "safetensors"


@io_group.register(
    schema_id="chainner:pytorch:save_model",
    name="保存模型",
    description=[
        "将 PyTorch 模型保存到指定目录。",
        '这不能保证以其他程序可读的方式保存某些模型。特别是，它保存时没有某些脚本期望的 "load key"。',
    ],
    icon="MdSave",
    inputs=[
        ModelInput(),
        DirectoryInput(has_handle=True),
        TextInput("Model Name"),
        EnumInput(
            WeightFormat,
            "Weight Format",
            default=WeightFormat.PTH,
            option_labels={
                WeightFormat.PTH: "PyTorch (.pth)",
                WeightFormat.ST: "SafeTensors (.safetensors)",
            },
        ),
    ],
    outputs=[],
    side_effects=True,
)
def save_model_node(
    model: ModelDescriptor, directory: Path, name: str, weight_format: WeightFormat
) -> None:
    full_file = f"{name}.{weight_format.value}"
    full_path = directory / full_file
    logger.debug(f"Writing model to path: {full_path}")
    if weight_format == WeightFormat.PTH:
        torch.save(model.model.state_dict(), full_path)
    elif weight_format == WeightFormat.ST:
        save_file(model.model.state_dict(), full_path)
    else:
        raise ValueError(f"Unknown weight format: {weight_format}")
