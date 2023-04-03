from __future__ import annotations

import os
from typing import List, Tuple

import numpy as np
from sanic.log import logger

from process import IteratorContext

from ...impl.image_formats import get_available_image_formats
from ...node_base import IteratorNodeBase, NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import DirectoryInput, IteratorInput
from ...properties.outputs import DirectoryOutput, ImageOutput, NumberOutput, TextOutput
from ...utils.utils import list_all_files_sorted
from ..image.load_image import ImReadNode
from . import category as ImageCategory

PAIRED_IMAGE_ITERATOR_NODE_ID = "chainner:image:paired_file_iterator_load"


@NodeFactory.register(PAIRED_IMAGE_ITERATOR_NODE_ID)
class ImageFileIteratorLoadImageNodeA(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ImageOutput("Image A"),
            ImageOutput("Image B"),
            DirectoryOutput("Image Directory A"),
            DirectoryOutput("Image Directory B"),
            TextOutput("Subdirectory Path A"),
            TextOutput("Subdirectory Path B"),
            TextOutput("Image Name A"),
            TextOutput("Image Name B"),
            NumberOutput("Overall Index"),
        ]

        self.category = ImageCategory
        self.name = "Load Image (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self, path_a: str, path_b: str, root_dir_a: str, root_dir_b: str, index: int
    ) -> Tuple[np.ndarray, np.ndarray, str, str, str, str, str, str, int]:
        img_a, img_dir_a, basename_a = ImReadNode().run(path_a)
        img_b, img_dir_b, basename_b = ImReadNode().run(path_b)

        # Get relative path from root directory passed by Iterator directory input
        rel_path_a = os.path.relpath(img_dir_a, root_dir_a)
        rel_path_b = os.path.relpath(img_dir_b, root_dir_b)

        return (
            img_a,
            img_b,
            root_dir_a,
            root_dir_b,
            rel_path_a,
            rel_path_b,
            basename_a,
            basename_b,
            index,
        )


@NodeFactory.register("chainner:image:paired_image_file_iterator")
class PairedImageFileIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Iterate over all files in two directories and run the provided nodes on the image files together. This can be useful for things like making comparisons of already upscaled content."
        self.inputs = [
            DirectoryInput("Directory A"),
            DirectoryInput("Directory B"),
        ]
        self.outputs = []
        self.category = ImageCategory
        self.name = "Image Pairs Iterator"
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": PAIRED_IMAGE_ITERATOR_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(
        self, directory_a: str, directory_b: str, context: IteratorContext
    ) -> None:
        logger.debug(
            f"Iterating over images in directories: {directory_a}, {directory_b}"
        )

        img_path_node_id = context.get_helper(PAIRED_IMAGE_ITERATOR_NODE_ID).id

        supported_filetypes = get_available_image_formats()

        just_image_files_a: List[str] = list_all_files_sorted(
            directory_a, supported_filetypes
        )
        just_image_files_b: List[str] = list_all_files_sorted(
            directory_b, supported_filetypes
        )

        assert len(just_image_files_a) == len(just_image_files_b), (
            "Number of images in directories A and B must be equal. "
            f"Directory A: {directory_a} has {len(just_image_files_a)} images. "
            f"Directory B: {directory_b} has {len(just_image_files_b)} images."
        )

        def before(filepaths: Tuple[str, str], index: int):
            a, b = filepaths
            context.inputs.set_values(
                img_path_node_id, [a, b, directory_a, directory_b, index]
            )

        await context.run(zip(just_image_files_a, just_image_files_b), before)
