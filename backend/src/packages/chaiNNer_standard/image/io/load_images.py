from __future__ import annotations

import os
from typing import Tuple

import numpy as np
from load_image import load_image_node

from api import Iterator
from nodes.properties.inputs import DirectoryInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, LargeImageOutput

from .. import io_group


@io_group.register(
    schema_id="chainner:image:load_images",
    name="Load Images",
    description=("Proof of concept"),
    icon="BsFillImageFill",
    inputs=[
        DirectoryInput("Directory"),
    ],
    outputs=[
        LargeImageOutput().with_docs(
            "The node will display a preview of the selected image as well as type"
            " information for it. Connect this output to the input of another node to"
            " pass the image to it."
        ),
        DirectoryOutput("Directory", of_input=0),
        FileNameOutput("Name", of_input=0),
    ],
    node_type="newIterator",
)
def load_images_node(
    directory: str,
) -> Iterator[Tuple[np.ndarray, str, str]]:
    """Reads an image from the specified path and return it as a numpy array"""

    length = 0
    for _, _, files in os.walk(directory):
        for _ in files:
            length += 1

    def iterator():
        for root, _, files in os.walk(directory):
            for file in files:
                path = os.path.join(root, file)
                yield load_image_node(path)

    return Iterator(iter_supplier=iterator, expected_length=length)
