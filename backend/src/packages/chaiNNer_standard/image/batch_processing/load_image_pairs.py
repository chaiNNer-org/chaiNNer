from __future__ import annotations

import os
from pathlib import Path

import numpy as np

from api import Iterator, IteratorOutputInfo
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
    icon="BsImages",
    inputs=[
        DirectoryInput("Directory A"),
        DirectoryInput("Directory B"),
        BoolInput("Use limit", default=False),
        if_group(Condition.bool(2, True))(
            NumberInput("Limit", default=10, min=1).with_docs(
                "Limit the number of images to iterate over. This can be useful for testing the iterator without having to iterate over all images."
            )
        ),
        BoolInput("Stop on first error", default=False).with_docs(
            "Instead of collecting errors and throwing them at the end of processing, stop iteration and throw an error as soon as one occurs.",
            hint=True,
        ),
    ],
    outputs=[
        ImageOutput("Image A"),
        ImageOutput("Image B"),
        DirectoryOutput("Directory A", output_type="Input0"),
        DirectoryOutput("Directory B", output_type="Input1"),
        TextOutput("Subdirectory Path A"),
        TextOutput("Subdirectory Path B"),
        TextOutput("Image Name A"),
        TextOutput("Image Name B"),
        NumberOutput(
            "Index",
            output_type="if Input2 { min(uint, Input3 - 1) } else { uint }",
        ).with_docs("A counter that starts at 0 and increments by 1 for each image."),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 1, 4, 5, 6, 7, 8]),
    kind="newIterator",
)
def load_image_pairs_node(
    directory_a: Path,
    directory_b: Path,
    use_limit: bool,
    limit: int,
    fail_fast: bool,
) -> tuple[
    Iterator[tuple[np.ndarray, np.ndarray, str, str, str, str, int]], Path, Path
]:
    def load_images(filepaths: tuple[Path, Path], index: int):
        path_a, path_b = filepaths
        img_a, img_dir_a, basename_a = load_image_node(path_a)
        img_b, img_dir_b, basename_b = load_image_node(path_b)

        # Get relative path from root directory passed by Iterator directory input
        rel_path_a = os.path.relpath(img_dir_a, directory_a)
        rel_path_b = os.path.relpath(img_dir_b, directory_b)
        return img_a, img_b, rel_path_a, rel_path_b, basename_a, basename_b, index

    supported_filetypes = get_available_image_formats()

    image_files_a: list[Path] = list_all_files_sorted(directory_a, supported_filetypes)
    image_files_b: list[Path] = list_all_files_sorted(directory_b, supported_filetypes)

    if use_limit:
        image_files_a = image_files_a[:limit]
        image_files_b = image_files_b[:limit]

    assert len(image_files_a) == len(image_files_b), (
        "Number of images in directories A and B must be equal. "
        f"Directory A: {directory_a} has {len(image_files_a)} images. "
        f"Directory B: {directory_b} has {len(image_files_b)} images."
    )

    image_files = list(zip(image_files_a, image_files_b))

    return (
        Iterator.from_list(image_files, load_images, fail_fast),
        directory_a,
        directory_b,
    )
