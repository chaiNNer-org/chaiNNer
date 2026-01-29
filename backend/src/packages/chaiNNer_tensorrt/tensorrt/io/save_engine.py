from __future__ import annotations

from pathlib import Path

from logger import logger
from nodes.impl.tensorrt.model import TensorRTEngine
from nodes.properties.inputs import DirectoryInput, RelativePathInput, TensorRTEngineInput

from .. import io_group

if io_group is not None:

    @io_group.register(
        schema_id="chainner:tensorrt:save_engine",
        name="Save Engine",
        description=(
            "Save a TensorRT engine to a file (.engine). "
            "The saved engine is specific to your GPU architecture and TensorRT version."
        ),
        icon="MdSave",
        inputs=[
            TensorRTEngineInput(),
            DirectoryInput(must_exist=False),
            RelativePathInput("Engine Name"),
        ],
        outputs=[],
        side_effects=True,
    )
    def save_engine_node(
        engine: TensorRTEngine, directory: Path, engine_name: str
    ) -> None:
        full_path = (directory / f"{engine_name}.engine").resolve()
        logger.debug("Writing TensorRT engine to path: %s", full_path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(engine.bytes)
