from __future__ import annotations

import os
from typing import List, Tuple

from sanic.log import logger

from nodes.impl.onnx.model import OnnxModel
from nodes.properties.inputs import DirectoryInput, IteratorInput
from nodes.properties.outputs import (
    DirectoryOutput,
    NumberOutput,
    OnnxModelOutput,
    TextOutput,
)
from nodes.utils.utils import list_all_files_sorted
from process import IteratorContext

from .. import batch_processing_group
from ..io.load_model import load_model_node

ONNX_ITERATOR_NODE_ID = "chainner:onnx:model_iterator_load"


@batch_processing_group.register(
    schema_id=ONNX_ITERATOR_NODE_ID,
    name="Load Model (Iterator)",
    description="",
    icon="MdSubdirectoryArrowRight",
    inputs=[IteratorInput().make_optional()],
    outputs=[
        OnnxModelOutput(),
        DirectoryOutput("Model Directory"),
        TextOutput("Subdirectory Path"),
        TextOutput("Model Name"),
        NumberOutput("Overall Index", output_type="uint").with_docs(
            "A counter that starts at 0 and increments by 1 for each model."
        ),
    ],
    node_type="iteratorHelper",
    side_effects=True,
)
def iterator_helper_load_model_node(
    path: str, root_dir: str, index: int
) -> Tuple[OnnxModel, str, str, str, int]:
    model, dirname, basename = load_model_node(path)

    # Get relative path from root directory passed by Iterator directory input
    rel_path = os.path.relpath(dirname, root_dir)

    return model, root_dir, rel_path, basename, index


@batch_processing_group.register(
    schema_id="chainner:onnx:model_file_iterator",
    name="Model File Iterator",
    description="Iterate over all files in a directory and run the provided nodes on just the ONNX model files (.onnx). Supports the same models as `chainner:onnx:load_model`.",
    icon="MdLoop",
    inputs=[
        DirectoryInput(),
    ],
    outputs=[],
    default_nodes=[
        # TODO: Figure out a better way to do this
        {
            "schemaId": ONNX_ITERATOR_NODE_ID,
        },
    ],
    node_type="iterator",
    side_effects=True,
)
async def model_file_iterator_node(directory: str, context: IteratorContext) -> None:
    logger.debug(f"Iterating over models in directory: {directory}")

    model_path_node_id = context.get_helper(ONNX_ITERATOR_NODE_ID).id

    supported_filetypes = [".onnx"]

    just_model_files: List[str] = list_all_files_sorted(directory, supported_filetypes)

    def before(filepath: str, index: int):
        context.inputs.set_values(model_path_node_id, [filepath, directory, index])

    await context.run(just_model_files, before)
