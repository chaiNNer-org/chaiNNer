from pathlib import Path

from sanic.log import logger

from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.properties.inputs import DirectoryInput, NcnnModelInput, TextInput

from .. import io_group


@io_group.register(
    schema_id="chainner:ncnn:save_model",
    name="Save Model",
    description="Save an NCNN model to specified directory. It can also be saved in fp16 mode for smaller file size and faster processing.",
    icon="MdSave",
    inputs=[
        NcnnModelInput(),
        DirectoryInput(create=True),
        TextInput("Param/Bin Name"),
    ],
    outputs=[],
    side_effects=True,
)
def save_model_node(model: NcnnModelWrapper, directory: Path, name: str) -> None:
    full_bin = f"{name}.bin"
    full_param = f"{name}.param"
    full_bin_path = directory / full_bin
    full_param_path = directory / full_param

    logger.debug(f"Writing NCNN model to paths: {full_bin_path} {full_param_path}")
    model.model.write_bin(full_bin_path)
    model.model.write_param(full_param_path)
