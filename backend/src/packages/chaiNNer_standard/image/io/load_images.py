from __future__ import annotations

import os
from typing import Tuple

import numpy as np

from api import Iterator
from nodes.properties.inputs import DirectoryInput
from nodes.properties.outputs import (
    DirectoryOutput,
    FileNameOutput,
    LargeImageOutput,
    NumberOutput,
)

from .. import io_group
from .load_image import load_image_node


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
        NumberOutput("Index"),
    ],
    node_type="newIterator",
)
def load_images_node(
    directory: str,
) -> Iterator[Tuple[np.ndarray, str, str, int]]:
    length = 0
    for _, _, files in os.walk(directory):
        for _ in files:
            length += 1

    def iterator():
        for root, _, files in os.walk(directory):
            for idx, file in enumerate(files):
                path = os.path.join(root, file)
                img, dirname, basename = load_image_node(path)
                yield img, dirname, basename, idx

    return Iterator(iter_supplier=iterator, expected_length=length)
