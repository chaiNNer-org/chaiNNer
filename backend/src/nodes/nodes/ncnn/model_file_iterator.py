from __future__ import annotations

import os

from sanic.log import logger

from process import IteratorContext

from ...impl.ncnn.model import NcnnModelWrapper
from ...node_base import IteratorNodeBase, NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import *
from ...properties.outputs import (
    DirectoryOutput,
    NcnnModelOutput,
    NumberOutput,
    TextOutput,
)
from ...utils.utils import list_all_files_sorted
from . import category as NcnnCategory
from .load_model import NcnnLoadModelNode

NCNN_ITERATOR_NODE_ID = "chainner:ncnn:model_iterator_load"


@NodeFactory.register(NCNN_ITERATOR_NODE_ID)
class ModelFileIteratorLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            NcnnModelOutput(),
            DirectoryOutput("Model Directory"),
            TextOutput("Subdirectory Path"),
            TextOutput("Model Name"),
            NumberOutput("Overall Index"),
        ]

        self.category = NcnnCategory
        self.name = "Load Model (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self, param_path: str, bin_path: str, root_dir: str, index: int
    ) -> Tuple[NcnnModelWrapper, str, str, str, int]:
        model, _, model_name = NcnnLoadModelNode().run(param_path, bin_path)

        dirname, _ = os.path.split(param_path)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(dirname, root_dir)

        return model, root_dir, rel_path, model_name, index


@NodeFactory.register("chainner:ncnn:model_file_iterator")
class ModelFileIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Iterate over all files in a directory and run the provided nodes on just the NCNN model files (.param/.bin). Supports everything _Load Model_ does."
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.category = NcnnCategory
        self.name = "Model File Iterator"
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": NCNN_ITERATOR_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(self, directory: str, context: IteratorContext) -> None:
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
