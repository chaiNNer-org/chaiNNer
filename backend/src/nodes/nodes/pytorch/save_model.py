from __future__ import annotations

import os

import torch
from sanic.log import logger

from . import category as PyTorchCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ModelInput, DirectoryInput, TextInput
from ...utils.torch_types import PyTorchModel


@NodeFactory.register("chainner:pytorch:save_model")
class PthSaveNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Save a PyTorch model to specified directory."
        self.inputs = [
            ModelInput(),
            DirectoryInput(has_handle=True),
            TextInput("Model Name"),
        ]
        self.outputs = []

        self.category = PyTorchCategory
        self.name = "Save Model"
        self.icon = "MdSave"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, model: PyTorchModel, directory: str, name: str) -> None:
        full_file = f"{name}.pth"
        full_path = os.path.join(directory, full_file)
        logger.info(f"Writing model to path: {full_path}")
        torch.save(model.state, full_path)
