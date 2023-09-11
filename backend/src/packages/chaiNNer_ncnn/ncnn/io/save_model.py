import os

from sanic.log import logger

from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.properties.inputs import BoolInput, DirectoryInput, NcnnModelInput, TextInput

from .. import io_group


@io_group.register(
    schema_id="chainner:ncnn:save_model",
    name="Save Model",
    description="Save an NCNN model to specified directory. It can also be saved in fp16 mode for smaller file size and faster processing.",
    icon="MdSave",
    inputs=[
        NcnnModelInput(),
        DirectoryInput(has_handle=True),
        TextInput("Param/Bin Name"),
        BoolInput("Overwrite Files", default=False),
    ],
    outputs=[],
    side_effects=True,
)
def save_model_node(
    model: NcnnModelWrapper, directory: str, name: str, overwrite_files: bool
) -> None:
    full_bin = f"{name}.bin"
    full_param = f"{name}.param"
    full_bin_path = os.path.join(directory, full_bin)
    full_param_path = os.path.join(directory, full_param)

    if overwrite_files or not os.path.exists(full_bin_path):
        logger.debug(f"Writing NCNN bin to path: {full_bin_path}")
        model.model.write_bin(full_bin_path)
    else:
        logger.debug(f"File already exists at path: {full_bin_path}, skipping.")

    if overwrite_files or not os.path.exists(full_param_path):
        logger.debug(f"Writing NCNN param to path: {full_param_path}")
        model.model.write_param(full_param_path)
    else:
        logger.debug(f"File already exists at path: {full_param_path}, skipping.")
