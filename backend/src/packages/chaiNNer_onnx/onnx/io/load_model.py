from __future__ import annotations

import os
from pathlib import Path

import onnx

from logger import logger
from nodes.impl.onnx.load import load_onnx_model
from nodes.impl.onnx.model import OnnxModel
from nodes.properties.inputs import OnnxFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, OnnxModelOutput
from nodes.utils.utils import split_file_path

from .. import io_group


@io_group.register(
    schema_id="chainner:onnx:load_model",
    name="Load Model",
    description=(
        "Load ONNX model file (.onnx). Theoretically supports any ONNX Super-Resolution"
        " model that doesn't expect non-standard preprocessing. Also supports RemBG"
        " background removal models."
    ),
    icon="ONNX",
    inputs=[OnnxFileInput(primary_input=True)],
    outputs=[
        OnnxModelOutput(kind="tagged").suggest(),
        DirectoryOutput("Directory", of_input=0).with_id(2),
        FileNameOutput("Name", of_input=0).with_id(1),
    ],
    see_also=[
        "chainner:onnx:load_models",
    ],
    side_effects=True,
)
def load_model_node(path: Path) -> tuple[OnnxModel, Path, str]:
    assert os.path.exists(path), f"Model file at location {path} does not exist"

    assert os.path.isfile(path), f"Path {path} is not a file"

    logger.debug("Reading onnx model from path: %s", path)
    model = onnx.load_model(str(path))

    dirname, basename, _ = split_file_path(path)
    return load_onnx_model(model), dirname, basename
