from __future__ import annotations

import os

import torch
from sanic.log import logger

from nodes.impl.pytorch.types import PyTorchModel
from nodes.properties.inputs import BoolInput, DirectoryInput, ModelInput, TextInput

from .. import io_group


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
        BoolInput("Overwrite Files", default=False),
    ],
    outputs=[],
    side_effects=True,
)
def save_model_node(
    model: PyTorchModel, directory: str, name: str, overwrite_files: bool
) -> None:
    full_file = f"{name}.pth"
    full_path = os.path.join(directory, full_file)
    if overwrite_files or not os.path.exists(full_path):
        logger.debug(f"Writing model to path: {full_path}")
        torch.save(model.state, full_path)
    else:
        logger.debug(f"File already exists at path: {full_path}, skipping.")
