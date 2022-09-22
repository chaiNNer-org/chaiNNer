from __future__ import annotations

import os

from sanic.log import logger
from process import IteratorContext

from .pytorch_nodes import LoadModelNode
from .categories import PyTorchCategory
from .node_base import NodeBase, IteratorNodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.torch_types import PyTorchModel

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
        logger.info(f"Iterating over models in directory: {directory}")

        model_path_node_id = context.get_helper(PYTORCH_ITERATOR_NODE_ID).id

        supported_filetypes = [".pth"]

        def walk_error_handler(exception_instance):
            logger.warning(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        just_model_files: List[str] = []
        for root, _dirs, files in os.walk(
            directory, topdown=True, onerror=walk_error_handler
        ):
            await context.progress.suspend()

            for name in sorted(files):
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_model_files.append(filepath)

        def before(filepath: str, index: int):
            context.inputs.set_values(model_path_node_id, [filepath, directory, index])

        await context.run(just_model_files, before)
