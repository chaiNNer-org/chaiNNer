from pathlib import Path

from logger import get_logger_from_env

logger = get_logger_from_env()

from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.properties.inputs import DirectoryInput, NcnnModelInput, RelativePathInput

from .. import io_group


@io_group.register(
    schema_id="chainner:ncnn:save_model",
    name="Save Model",
    description="Save an NCNN model to specified directory. It can also be saved in fp16 mode for smaller file size and faster processing.",
    icon="MdSave",
    inputs=[
        NcnnModelInput(),
        DirectoryInput(must_exist=False),
        RelativePathInput("Param/Bin Name"),
    ],
    outputs=[],
    side_effects=True,
)
def save_model_node(model: NcnnModelWrapper, directory: Path, name: str) -> None:
    full_bin_path = (directory / f"{name}.bin").resolve()
    full_param_path = (directory / f"{name}.param").resolve()

    logger.debug("Writing NCNN model to paths: %s %s", full_bin_path, full_param_path)

    full_bin_path.parent.mkdir(parents=True, exist_ok=True)
    model.model.write_bin(full_bin_path)
    model.model.write_param(full_param_path)
