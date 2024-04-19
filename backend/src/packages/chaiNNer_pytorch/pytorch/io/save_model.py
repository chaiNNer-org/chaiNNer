from __future__ import annotations

from enum import Enum
from pathlib import Path

import torch
from safetensors.torch import save_file
from sanic.log import logger
from spandrel import ModelDescriptor

from nodes.properties.inputs import (
    DirectoryInput,
    EnumInput,
    ModelInput,
    RelativePathInput,
)

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
        DirectoryInput(must_exist=False),
        RelativePathInput("Model Name"),
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
    full_path = (directory / f"{name}.{weight_format.value}").resolve()
    logger.debug(f"Writing model to path: {full_path}")
    full_path.parent.mkdir(parents=True, exist_ok=True)
    if weight_format == WeightFormat.PTH:
        torch.save(model.model.state_dict(), full_path)
    elif weight_format == WeightFormat.ST:
        save_file(model.model.state_dict(), full_path)
    else:
        raise ValueError(f"Unknown weight format: {weight_format}")
