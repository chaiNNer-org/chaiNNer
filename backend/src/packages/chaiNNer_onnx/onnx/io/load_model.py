from __future__ import annotations

import os
from typing import Tuple

import onnx
from sanic.log import logger

from nodes.impl.onnx.model import OnnxModel, load_onnx_model
from nodes.properties.inputs import OnnxFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, OnnxModelOutput
from nodes.utils.utils import split_file_path

from .. import io_group


@io_group.register(
    schema_id="chainner:onnx:load_model",
    name="Load Model",
    description=(
        """Load ONNX model file (.onnx). Theoretically supports any ONNX model."""
    ),
    icon="ONNX",
    inputs=[OnnxFileInput(primary_input=True)],
    outputs=[
        OnnxModelOutput(),
        DirectoryOutput("Model Directory", of_input=0).with_id(2),
        FileNameOutput("Model Name", of_input=0).with_id(1),
    ],
    see_also=[
        "chainner:onnx:model_file_iterator",
    ],
)
def load_model_node(path: str) -> Tuple[OnnxModel, str, str]:
    """Read a pth file from the specified path and return it as a state dict
    and loaded model after finding arch config"""

    assert os.path.exists(path), f"Model file at location {path} does not exist"

    assert os.path.isfile(path), f"Path {path} is not a file"

    logger.debug(f"Reading onnx model from path: {path}")
    model = onnx.load_model(path)

    model_as_string = model.SerializeToString()

    dirname, basename, _ = split_file_path(path)
    return load_onnx_model(model_as_string), dirname, basename
