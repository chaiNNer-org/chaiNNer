from __future__ import annotations

import os
from typing import Tuple


from . import category as StableDiffusionCategory
from nodes.impl.stable_diffusion.types import SDKitModel
from ...impl.stable_diffusion.stable_diffusion import StableDiffusion
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import PthFileInput
from ...properties.outputs import SDKitModelOutput, DirectoryOutput, FileNameOutput
from ...utils.utils import split_file_path


@NodeFactory.register("chainner:stable_diffusion:load_model")
class LoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [PthFileInput(primary_input=True)]
        self.outputs = [
            SDKitModelOutput(),
            DirectoryOutput("Model Directory", of_input=0).with_id(2),
            FileNameOutput("Model Name", of_input=0).with_id(1),
        ]

        self.category = StableDiffusionCategory
        self.name = "Load Model"
        self.icon = "BsFillImageFill"
        self.sub = "Input & Output"

    def run(self, path: str) -> Tuple[SDKitModel, str, str]:
        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        dirname, basename, _ = split_file_path(path)

        sd = StableDiffusion.from_file(path)
        model = SDKitModel(sd)

        return model, dirname, basename
