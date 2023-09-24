from __future__ import annotations

import os
from typing import List, Tuple

import numpy as np
from sanic.log import logger

from api import Iterator
from nodes.groups import Condition, if_group
from nodes.impl.image_formats import get_available_image_formats
from nodes.properties.inputs import BoolInput, DirectoryInput, NumberInput
from nodes.properties.outputs import (
    DirectoryOutput,
    ImageOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import list_all_files_sorted

from .. import batch_processing_group
from ..io.load_image import load_image_node


@batch_processing_group.register(
    schema_id="chainner:image:load_image_pairs",
    name="Load Image Pairs",
    description="Iterate over all files in two directories and run the provided nodes on the image files together. This can be useful for things like making comparisons of already processed content.",
    icon="BsFillImageFill",
    inputs=[
        DirectoryInput("Directory A"),
        DirectoryInput("Directory B"),
        BoolInput("Use limit", default=False),
        if_group(Condition.bool(2, True))(
            NumberInput("Limit", default=10).with_docs(
                "Limit the number of images to iterate over. This can be useful for testing the iterator without having to iterate over all images."
            )
        ),
    ],
    outputs=[
        ImageOutput("Image A"),
        ImageOutput("Image B"),
        DirectoryOutput("Image Directory A"),
        DirectoryOutput("Image Directory B"),
        TextOutput("Subdirectory Path A"),
        TextOutput("Subdirectory Path B"),
        TextOutput("Image Name A"),
        TextOutput("Image Name B"),
        NumberOutput("Overall Index", output_type="uint").with_docs(
            "A counter that starts at 0 and increments by 1 for each image."
        ),
    ],
    node_type="newIterator",
)
def load_image_pairs_node(
    directory_a: str,
    directory_b: str,
    use_limit: bool,
    limit: int,
) -> Iterator[Tuple[np.ndarray, np.ndarray, str, str, str, str, str, str, int]]:
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

    if use_limit:
        just_image_files_a = just_image_files_a[:limit]
        just_image_files_b = just_image_files_b[:limit]

    length = len(just_image_files_a)

    def iterator():
        for idx, filepaths in enumerate(zip(just_image_files_a, just_image_files_b)):
            path_a, path_b = filepaths
            img_a, img_dir_a, basename_a = load_image_node(path_a)
            img_b, img_dir_b, basename_b = load_image_node(path_b)

            # Get relative path from root directory passed by Iterator directory input
            rel_path_a = os.path.relpath(img_dir_a, directory_a)
            rel_path_b = os.path.relpath(img_dir_b, directory_b)
            yield img_a, img_b, directory_a, directory_b, rel_path_a, rel_path_b, basename_a, basename_b, idx,

    return Iterator(iter_supplier=iterator, expected_length=length)
