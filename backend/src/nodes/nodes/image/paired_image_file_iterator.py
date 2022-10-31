from __future__ import annotations

import os
from typing import Tuple, List

import numpy as np
from process import IteratorContext
from sanic.log import logger

from . import category as ImageCategory
from ..image.load_image import ImReadNode
from ...node_base import IteratorNodeBase, NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import IteratorInput, DirectoryInput
from ...properties.outputs import (
    ImageOutput,
    DirectoryOutput,
    TextOutput,
    NumberOutput,
)
from ...utils.image_utils import get_available_image_formats
from ...utils.utils import alphanumeric_sort

PAIRED_IMAGE_ITERATOR_NODE_ID = "chainner:image:paired_file_iterator_load"


@NodeFactory.register(PAIRED_IMAGE_ITERATOR_NODE_ID)
class ImageFileIteratorLoadImageNodeA(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ImageOutput("Image A", broadcast_type=True),
            ImageOutput("Image B", broadcast_type=True),
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

        def walk_error_handler(exception_instance):
            logger.warning(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        just_image_files_a: List[str] = []
        for root, dirs, files in os.walk(
            directory_a, topdown=True, onerror=walk_error_handler
        ):
            await context.progress.suspend()

            dirs.sort(key=alphanumeric_sort)
            for name in sorted(files, key=alphanumeric_sort):
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_image_files_a.append(filepath)

        just_image_files_b: List[str] = []
        for root, dirs, files in os.walk(
            directory_b, topdown=True, onerror=walk_error_handler
        ):
            await context.progress.suspend()

            dirs.sort(key=alphanumeric_sort)
            for name in sorted(files, key=alphanumeric_sort):
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_image_files_b.append(filepath)

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
