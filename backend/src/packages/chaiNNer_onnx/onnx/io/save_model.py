from __future__ import annotations

import os
from typing import TYPE_CHECKING

from sanic.log import logger

from nodes.properties.inputs import DirectoryInput, OnnxModelInput, TextInput

from .. import io_group

if TYPE_CHECKING:
    from nodes.impl.onnx.model import OnnxModel


@io_group.register(
    schema_id="chainner:onnx:save_model",
    name="Save Model",
    description="""Save ONNX model to file (.onnx).""",
    icon="MdSave",
    inputs=[
        OnnxModelInput(),
        DirectoryInput(has_handle=True),
        TextInput("Model Name"),
    ],
    outputs=[],
    side_effects=True,
)
def save_model_node(model: OnnxModel, directory: str, model_name: str) -> None:
    full_path = f"{os.path.join(directory, model_name)}.onnx"
    logger.debug(f"Writing file to path: {full_path}")
    with open(full_path, "wb") as f:
        f.write(model.bytes)
