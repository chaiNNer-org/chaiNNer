from __future__ import annotations

import os

from sanic.log import logger
from process import IteratorContext

from .load_model import LoadModelNode
from . import category as PyTorchCategory
from ...api.node_base import NodeBase, IteratorNodeBase
from ...api.node_factory import NodeFactory
from ...api.inputs import *
from ...api.outputs import *
from ...utils.torch_types import PyTorchModel
from ...utils.utils import list_all_files_sorted

PYTORCH_ITERATOR_NODE_ID = "chainner:pytorch:model_iterator_load"


@NodeFactory.register(PYTORCH_ITERATOR_NODE_ID)
class ModelFileIteratorLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ModelOutput(should_broadcast=True),
            DirectoryOutput("Model Directory"),
            TextOutput("Subdirectory Path"),
            TextOutput("Model Name"),
            NumberOutput("Overall Index"),
        ]

        self.category = PyTorchCategory
        self.name = "Load Model (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self, path: str, root_dir: str, index: int
    ) -> Tuple[PyTorchModel, str, str, str, int]:
        model, dirname, basename = LoadModelNode().run(path)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(dirname, root_dir)

        return model, root_dir, rel_path, basename, index


@NodeFactory.register("chainner:pytorch:model_file_iterator")
class ModelFileIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Iterate over all files in a directory and run the provided nodes on just the PyTorch model files (.pth). Supports everything _Load Model_ does."
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.category = PyTorchCategory
        self.name = "Model File Iterator"
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": PYTORCH_ITERATOR_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(self, directory: str, context: IteratorContext) -> None:
        logger.debug(f"Iterating over models in directory: {directory}")

        model_path_node_id = context.get_helper(PYTORCH_ITERATOR_NODE_ID).id

        supported_filetypes = [".pth"]

        just_model_files: List[str] = list_all_files_sorted(
            directory, supported_filetypes
        )

        def before(filepath: str, index: int):
            context.inputs.set_values(model_path_node_id, [filepath, directory, index])

        await context.run(just_model_files, before)
