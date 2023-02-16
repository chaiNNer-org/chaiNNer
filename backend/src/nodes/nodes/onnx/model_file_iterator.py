from __future__ import annotations

import os

from sanic.log import logger
from process import IteratorContext

from .load_model import OnnxLoadModelNode
from . import category as OnnxCategory
from ...node_base import NodeBase, IteratorNodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import *
from ...properties.outputs import (
    OnnxModelOutput,
    DirectoryOutput,
    TextOutput,
    NumberOutput,
)
from ...impl.onnx.model import OnnxModel
from ...utils.utils import list_all_files_sorted

ONNX_ITERATOR_NODE_ID = "chainner:onnx:model_iterator_load"


@NodeFactory.register(ONNX_ITERATOR_NODE_ID)
class ModelFileIteratorLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            OnnxModelOutput(),
            DirectoryOutput("Model Directory"),
            TextOutput("Subdirectory Path"),
            TextOutput("Model Name"),
            NumberOutput("Overall Index"),
        ]

        self.category = OnnxCategory
        self.name = "Load Model (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self, path: str, root_dir: str, index: int
    ) -> Tuple[OnnxModel, str, str, str, int]:
        model, dirname, basename = OnnxLoadModelNode().run(path)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(dirname, root_dir)

        return model, root_dir, rel_path, basename, index


@NodeFactory.register("chainner:onnx:model_file_iterator")
class ModelFileIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Iterate over all files in a directory and run the provided nodes on just the ONNX model files (.onnx). Supports everything _Load Model_ does."
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.category = OnnxCategory
        self.name = "Model File Iterator"
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": ONNX_ITERATOR_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(self, directory: str, context: IteratorContext) -> None:
        logger.debug(f"Iterating over models in directory: {directory}")

        model_path_node_id = context.get_helper(ONNX_ITERATOR_NODE_ID).id

        supported_filetypes = [".onnx"]

        just_model_files: List[str] = list_all_files_sorted(
            directory, supported_filetypes
        )

        def before(filepath: str, index: int):
            context.inputs.set_values(model_path_node_id, [filepath, directory, index])

        await context.run(just_model_files, before)
