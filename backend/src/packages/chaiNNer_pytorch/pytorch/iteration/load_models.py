from __future__ import annotations

import os
from typing import List, Tuple

from sanic.log import logger

from api import Iterator
from nodes.impl.pytorch.types import PyTorchModel
from nodes.properties.inputs import DirectoryInput
from nodes.properties.outputs import DirectoryOutput, NumberOutput, TextOutput
from nodes.properties.outputs.pytorch_outputs import ModelOutput
from nodes.utils.utils import list_all_files_sorted

from .. import batch_processing_group
from ..io.load_model import load_model_node


@batch_processing_group.register(
    schema_id="chainner:pytorch:load_models",
    name="Load Models",
    description=(
        "Iterate over all files in a directory and run the provided nodes on just the"
        " PyTorch model files (.pth). Supports the same models as"
        " `chainner:pytorch:load_model`."
    ),
    icon="MdLoop",
    inputs=[
        DirectoryInput(),
    ],
    outputs=[
        ModelOutput(),
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
) -> Iterator[Tuple[PyTorchModel, str, str, str, int]]:
    logger.debug(f"Iterating over models in directory: {directory}")

    def load_model(path: str, index: int):
        model, dirname, basename = load_model_node(path)
        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(dirname, directory)
        return model, directory, rel_path, basename, index

    supported_filetypes = [".pt", ".pth", ".ckpt"]
    model_files: List[str] = list_all_files_sorted(directory, supported_filetypes)

    return Iterator.from_list(model_files, load_model)
