from __future__ import annotations

import os
from typing import List, Tuple

import numpy as np
from sanic.log import logger

from nodes.impl.image_formats import get_available_image_formats
from nodes.node_base import IteratorNodeBase, NodeBase
from nodes.properties.inputs import DirectoryInput, IteratorInput
from nodes.properties.outputs import (
    DirectoryOutput,
    ImageOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import list_all_files_sorted
from process import IteratorContext

from ..A_io.load_image import ImReadNode
from . import node_group

IMAGE_ITERATOR_NODE_ID = "chainner:image:file_iterator_load"


@node_group.register(
    schema_id=IMAGE_ITERATOR_NODE_ID,
    name="Load Image (Iterator)",
    description="",
    icon="MdSubdirectoryArrowRight",
    node_type="iteratorHelper",
)
class ImageFileIteratorLoadImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ImageOutput(broadcast_type=True),
            DirectoryOutput("Image Directory"),
            TextOutput("Subdirectory Path"),
            TextOutput("Image Name"),
            NumberOutput("Overall Index"),
        ]
        self.side_effects = True

    def run(
        self, path: str, root_dir: str, index: int
    ) -> Tuple[np.ndarray, str, str, str, int]:
        img, img_dir, basename = ImReadNode().run(path)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(img_dir, root_dir)

        return img, root_dir, rel_path, basename, index


@node_group.register(
    schema_id="chainner:image:file_iterator",
    name="Image File Iterator",
    description="Iterate over all files in a directory and run the provided nodes on just the image files.",
    icon="MdLoop",
    node_type="iterator",
)
class ImageFileIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": IMAGE_ITERATOR_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(self, directory: str, context: IteratorContext) -> None:
        logger.debug(f"Iterating over images in directory: {directory}")

        img_path_node_id = context.get_helper(IMAGE_ITERATOR_NODE_ID).id

        supported_filetypes = get_available_image_formats()

        just_image_files: List[str] = list_all_files_sorted(
            directory, supported_filetypes
        )

        def before(filepath: str, index: int):
            context.inputs.set_values(img_path_node_id, [filepath, directory, index])

        await context.run(just_image_files, before)
