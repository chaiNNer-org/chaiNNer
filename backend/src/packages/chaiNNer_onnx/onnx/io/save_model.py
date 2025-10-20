from __future__ import annotations

from pathlib import Path

from logger import get_logger_from_env
from nodes.impl.onnx.model import OnnxModel
from nodes.properties.inputs import DirectoryInput, OnnxModelInput, RelativePathInput

from .. import io_group

logger = get_logger_from_env()

@io_group.register(
    schema_id="chainner:onnx:save_model",
    name="Save Model",
    description="""Save ONNX model to file (.onnx).""",
    icon="MdSave",
    inputs=[
        OnnxModelInput(),
        DirectoryInput(must_exist=False),
        RelativePathInput("Model Name"),
    ],
    outputs=[],
    side_effects=True,
)
def save_model_node(model: OnnxModel, directory: Path, model_name: str) -> None:
    full_path = (directory / f"{model_name}.onnx").resolve()
    logger.debug(f"Writing file to path: {full_path}")
    full_path.parent.mkdir(parents=True, exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(model.bytes)
