from __future__ import annotations

import os
from typing import Tuple

import onnx
from sanic.log import logger

from ...impl.onnx.model import OnnxModel, load_onnx_model
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import OnnxFileInput
from ...properties.outputs import DirectoryOutput, FileNameOutput, OnnxModelOutput
from ...utils.utils import split_file_path
from . import category as ONNXCategory


@NodeFactory.register("chainner:onnx:load_model")
class OnnxLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            """Load ONNX model file (.onnx). Theoretically supports any ONNX model."""
        )
        self.inputs = [OnnxFileInput(primary_input=True)]
        self.outputs = [
            OnnxModelOutput(),
            DirectoryOutput("Model Directory", of_input=0).with_id(2),
            FileNameOutput("Model Name", of_input=0).with_id(1),
        ]

        self.category = ONNXCategory
        self.name = "Load Model"
        self.icon = "ONNX"
        self.sub = "Input & Output"

        self.model = None  # Defined in run

    def run(self, path: str) -> Tuple[OnnxModel, str, str]:
        """Read a pth file from the specified path and return it as a state dict
        and loaded model after finding arch config"""

        assert os.path.exists(path), f"Model file at location {path} does not exist"

        assert os.path.isfile(path), f"Path {path} is not a file"

        logger.debug(f"Reading onnx model from path: {path}")
        model = onnx.load_model(path)

        model_as_string = model.SerializeToString()

        dirname, basename, _ = split_file_path(path)
        return load_onnx_model(model_as_string), dirname, basename
