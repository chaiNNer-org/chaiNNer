from __future__ import annotations

import os
from typing import Tuple, List

import numpy as np
from process import IteratorContext
from sanic.log import logger

from ....categories import ImageCategory
from ..image_nodes import ImReadNode
from ....node_base import IteratorNodeBase, NodeBase
from ....node_factory import NodeFactory
from ....properties.inputs import IteratorInput, DirectoryInput
from ....properties.outputs import (
    ImageOutput,
    DirectoryOutput,
    TextOutput,
    NumberOutput,
)
from ....utils.image_utils import get_available_image_formats
from ....utils.utils import numerical_sort

IMAGE_ITERATOR_NODE_ID = "chainner:image:file_iterator_load"


@NodeFactory.register(IMAGE_ITERATOR_NODE_ID)
class ImageFileIteratorLoadImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ImageOutput(broadcast_type=True),
            DirectoryOutput("Image Directory"),
            TextOutput("Subdirectory Path"),
            TextOutput("Image Name"),
            NumberOutput("Overall Index"),
        ]

        self.category = ImageCategory
        self.name = "Load Image (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self, path: str, root_dir: str, index: int
    ) -> Tuple[np.ndarray, str, str, str, int]:
        img, img_dir, basename = ImReadNode().run(path)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(img_dir, root_dir)

        return img, root_dir, rel_path, basename, index


@NodeFactory.register("chainner:image:file_iterator")
class ImageFileIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Iterate over all files in a directory and run the provided nodes on just the image files."
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.category = ImageCategory
        self.name = "Image File Iterator"
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": IMAGE_ITERATOR_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(self, directory: str, context: IteratorContext) -> None:
        logger.info(f"Iterating over images in directory: {directory}")

        img_path_node_id = context.get_helper(IMAGE_ITERATOR_NODE_ID).id

        supported_filetypes = get_available_image_formats()

        def walk_error_handler(exception_instance):
            logger.warning(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        just_image_files: List[str] = []
        for root, dirs, files in os.walk(
            directory, topdown=True, onerror=walk_error_handler
        ):
            await context.progress.suspend()

            dirs.sort(key=numerical_sort)
            for name in sorted(files, key=numerical_sort):
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_image_files.append(filepath)

        def before(filepath: str, index: int):
            context.inputs.set_values(img_path_node_id, [filepath, directory, index])

        await context.run(just_image_files, before)
