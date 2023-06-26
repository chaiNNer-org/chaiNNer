from __future__ import annotations

import os
from typing import List, Tuple

from sanic.log import logger

from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.properties.inputs import DirectoryInput, IteratorInput
from nodes.properties.outputs import (
    DirectoryOutput,
    NcnnModelOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import list_all_files_sorted
from process import IteratorContext

from .. import batch_processing_group
from ..io.load_model import load_model_node

NCNN_ITERATOR_NODE_ID = "chainner:ncnn:model_iterator_load"


@batch_processing_group.register(
    schema_id=NCNN_ITERATOR_NODE_ID,
    name="Load Model (Iterator)",
    description="",
    icon="MdSubdirectoryArrowRight",
    inputs=[IteratorInput().make_optional()],
    outputs=[
        NcnnModelOutput(),
        DirectoryOutput("Model Directory"),
        TextOutput("Subdirectory Path"),
        TextOutput("Model Name"),
        NumberOutput("Overall Index", output_type="uint"),
    ],
    node_type="iteratorHelper",
    side_effects=True,
)
def ModelFileIteratorLoadModelNode(
    param_path: str, bin_path: str, root_dir: str, index: int
) -> Tuple[NcnnModelWrapper, str, str, str, int]:
    model, _, model_name = load_model_node(param_path, bin_path)

    dirname, _ = os.path.split(param_path)

    # Get relative path from root directory passed by Iterator directory input
    rel_path = os.path.relpath(dirname, root_dir)

    return model, root_dir, rel_path, model_name, index


@batch_processing_group.register(
    schema_id="chainner:ncnn:model_file_iterator",
    name="Model File Iterator",
    description="Iterate over all files in a directory and run the provided nodes on just the NCNN model files (.param/.bin). Supports the same models as [Load Model](#chainner:ncnn:load_model).",
    icon="MdLoop",
    inputs=[
        DirectoryInput(),
    ],
    outputs=[],
    default_nodes=[
        # TODO: Figure out a better way to do this
        {
            "schemaId": NCNN_ITERATOR_NODE_ID,
        },
    ],
    node_type="iterator",
    side_effects=True,
)
async def ModelFileIteratorNode(directory: str, context: IteratorContext) -> None:
    logger.debug(f"Iterating over models in directory: {directory}")

    model_path_node_id = context.get_helper(NCNN_ITERATOR_NODE_ID).id

    just_param_files: List[str] = list_all_files_sorted(directory, [".param"])
    just_bin_files: List[str] = list_all_files_sorted(directory, [".bin"])

    if len(just_param_files) != len(just_bin_files):
        raise ValueError(
            "The number of param files and bin files are not the same. Please check your directory."
        )

    # Check if the filenames match
    for param_file, bin_file in zip(just_param_files, just_bin_files):
        param_file_name, _ = os.path.splitext(param_file)
        bin_file_name, _ = os.path.splitext(bin_file)

        if param_file_name != bin_file_name:
            raise ValueError(
                f"Param file {param_file_name} does not match bin file {bin_file_name}. Please check your files."
            )

    just_model_files = list(zip(just_param_files, just_bin_files))

    def before(filepath_pairs: Tuple[str, str], index: int):
        context.inputs.set_values(
            model_path_node_id,
            [filepath_pairs[0], filepath_pairs[1], directory, index],
        )

    await context.run(just_model_files, before)
