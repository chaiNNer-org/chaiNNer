from __future__ import annotations

import math
import os

from sanic.log import logger
from process import ExecutionContext

from .pytorch_nodes import LoadModelNode
from .categories import PyTorchCategory
from .node_base import NodeBase, IteratorNodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *

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
            TextOutput("Relative Path"),
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
        self.description = "Iterate over all files in a directory and run the provided nodes on just the image files."
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
    async def run(self, directory: str, context: ExecutionContext) -> None:
        logger.info(f"Iterating over models in directory: {directory}")
        logger.info(context.nodes)

        model_path_node_id = None
        child_nodes: List[str] = []
        for k, v in context.nodes.items():
            if v["schemaId"] == PYTORCH_ITERATOR_NODE_ID:
                model_path_node_id = v["id"]
            if context.nodes[k]["child"]:
                child_nodes.append(v["id"])
            # Set this to false to actually allow processing to happen
            context.nodes[k]["child"] = False
        assert (
            model_path_node_id is not None
        ), "Unable to find model iterator helper node"

        supported_filetypes = [".pth"]

        def walk_error_handler(exception_instance):
            logger.warning(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        just_model_files: List[str] = []
        for root, _dirs, files in os.walk(
            directory, topdown=True, onerror=walk_error_handler
        ):
            if context.executor.should_stop_running():
                return

            for name in sorted(files):
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_model_files.append(filepath)

        file_len = len(just_model_files)
        start_idx = math.ceil(float(context.percent) * file_len)
        for idx, filepath in enumerate(just_model_files):
            if context.executor.should_stop_running():
                return
            if idx >= start_idx:
                await context.queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": idx / file_len,
                            "iteratorId": context.iterator_id,
                            "running": child_nodes,
                        },
                    }
                )
                # Replace the input filepath with the filepath from the loop
                context.nodes[model_path_node_id]["inputs"] = [filepath, directory, idx]
                executor = context.create_iterator_executor()
                await executor.run()
                await context.queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": (idx + 1) / file_len,
                            "iteratorId": context.iterator_id,
                            "running": None,
                        },
                    }
                )
