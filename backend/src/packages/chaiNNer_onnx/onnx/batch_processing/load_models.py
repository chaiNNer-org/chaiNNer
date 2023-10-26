from __future__ import annotations

import os

from api import Iterator, IteratorOutputInfo
from nodes.impl.onnx.model import OnnxModel
from nodes.properties.inputs import DirectoryInput
from nodes.properties.outputs import (
    DirectoryOutput,
    NumberOutput,
    OnnxModelOutput,
    TextOutput,
)
from nodes.utils.utils import list_all_files_sorted
from sanic.log import logger

from .. import batch_processing_group
from ..io.load_model import load_model_node


@batch_processing_group.register(
    schema_id="chainner:onnx:load_models",
    name="Load Models",
    description=(
        "Iterate over all files in a directory and run the provided nodes on just the"
        " ONNX model files (.onnx). Supports the same models as"
        " `chainner:onnx:load_model`."
    ),
    icon="MdLoop",
    inputs=[
        DirectoryInput(),
    ],
    outputs=[
        OnnxModelOutput(),
        DirectoryOutput("Directory", output_type="Input0"),
        TextOutput("Subdirectory Path"),
        TextOutput("Name"),
        NumberOutput("Index", output_type="uint").with_docs(
            "A counter that starts at 0 and increments by 1 for each model."
        ),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 2, 3, 4]),
    node_type="newIterator",
)
def load_models_node(
    directory: str,
) -> tuple[Iterator[tuple[OnnxModel, str, str, int]], str]:
    logger.debug(f"Iterating over models in directory: {directory}")

    def load_model(path: str, index: int):
        model, dirname, basename = load_model_node(path)
        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(dirname, directory)
        return model, rel_path, basename, index

    supported_filetypes = [".onnx"]
    model_files = list_all_files_sorted(directory, supported_filetypes)

    return Iterator.from_list(model_files, load_model), directory
