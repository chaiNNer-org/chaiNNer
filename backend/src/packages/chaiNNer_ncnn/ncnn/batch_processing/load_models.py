from __future__ import annotations

import os
from typing import List, Tuple

from sanic.log import logger

from api import Iterator
from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.properties.inputs import DirectoryInput
from nodes.properties.outputs import (
    DirectoryOutput,
    NcnnModelOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import list_all_files_sorted

from .. import batch_processing_group
from ..io.load_model import load_model_node


@batch_processing_group.register(
    schema_id="chainner:ncnn:load_models",
    name="Load Models",
    description=(
        "Iterate over all files in a directory and run the provided nodes on just the"
        " NCNN model files (.param/.bin). Supports the same models as"
        " `chainner:ncnn:load_model`."
    ),
    icon="MdLoop",
    inputs=[
        DirectoryInput(),
    ],
    outputs=[
        NcnnModelOutput(),
        DirectoryOutput("Directory"),
        TextOutput("Subdirectory Path"),
        TextOutput("Name"),
        NumberOutput("Index", output_type="uint").with_docs(
            "A counter that starts at 0 and increments by 1 for each model."
        ),
    ],
    node_type="newIterator",
)
def load_models_node(
    directory: str,
) -> Iterator[Tuple[NcnnModelWrapper, str, str, str, int]]:
    logger.debug(f"Iterating over models in directory: {directory}")

    def load_model(filepath_pairs: Tuple[str, str], index: int):
        model, dirname, basename = load_model_node(filepath_pairs[0], filepath_pairs[1])
        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(dirname, directory)
        return model, directory, rel_path, basename, index

    param_files: List[str] = list_all_files_sorted(directory, [".param"])
    bin_files: List[str] = list_all_files_sorted(directory, [".bin"])

    if len(param_files) != len(bin_files):
        raise ValueError(
            "The number of param files and bin files are not the same. Please check"
            " your directory."
        )

    # Check if the filenames match
    for param_file, bin_file in zip(param_files, bin_files):
        param_file_name, _ = os.path.splitext(param_file)
        bin_file_name, _ = os.path.splitext(bin_file)

        if param_file_name != bin_file_name:
            raise ValueError(
                f"Param file {param_file_name} does not match bin file {bin_file_name}."
                " Please check your files."
            )

    model_files = list(zip(param_files, bin_files))

    return Iterator.from_list(model_files, load_model)
