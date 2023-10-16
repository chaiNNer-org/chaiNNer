from __future__ import annotations

import os
from enum import Enum

import torch
from safetensors.torch import save_file
from sanic.log import logger

from nodes.impl.pytorch.types import PyTorchModel
from nodes.properties.inputs import DirectoryInput, EnumInput, ModelInput, TextInput

from .. import io_group


class WeightFormat(Enum):
    PTH = "pth"
    ST = "safetensors"


@io_group.register(
    schema_id="chainner:pytorch:save_model",
    name="Save Model",
    description=[
        "Save a PyTorch model to specified directory.",
        'This is not guaranteed to save certain models in a way that can be read by other programs. Notably, it saves without the "load key" some scripts expect.',
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
    model: PyTorchModel, directory: str, name: str, weight_format: WeightFormat
) -> None:
    full_file = f"{name}.{weight_format.value}"
    full_path = os.path.join(directory, full_file)
    logger.debug(f"Writing model to path: {full_path}")
    if weight_format == WeightFormat.PTH:
        torch.save(model.state_dict(), full_path)
    elif weight_format == WeightFormat.ST:
        save_file(model.state_dict(), full_path)
    else:
        raise ValueError(f"Unknown weight format: {weight_format}")
