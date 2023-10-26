from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from api import Iterator, IteratorOutputInfo
from nodes.groups import Condition, if_group
from nodes.impl.image_formats import get_available_image_formats
from nodes.properties.inputs import BoolInput, DirectoryInput, NumberInput, TextInput
from nodes.properties.outputs import (
    DirectoryOutput,
    ImageOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import alphanumeric_sort
from wcmatch import glob

from .. import batch_processing_group
from ..io.load_image import load_image_node


def extension_filter(lst: list[str]) -> str:
    """generates a mcmatch.glob expression to filter files with specific extensions
    ex. {*,**/*}@(*.png|*.jpg|...)"""
    return "**/*@(" + "|".join(lst) + ")"


def list_glob(directory: str, globexpr: str, ext_filter: list[str]) -> list[str]:
    extension_expr = extension_filter(ext_filter)

    flags = glob.EXTGLOB | glob.BRACE | glob.GLOBSTAR

    filtered = glob.globfilter(
        glob.iglob(globexpr, root_dir=directory, flags=flags),
        extension_expr,
        flags=flags | glob.IGNORECASE,
    )

    return sorted(
        list(set(map(lambda f: str(Path(directory) / f), filtered))),
        key=alphanumeric_sort,
    )


@batch_processing_group.register(
    schema_id="chainner:image:load_images",
    name="Load Images",
    description=[
        "Iterate over all files in a directory/folder (batch processing) and run the provided nodes on just the image files. Supports the same file types as `chainner:image:load`.",
        "Optionally, you can toggle whether to iterate recursively (subdirectories) or use a glob expression to filter the files.",
    ],
    icon="BsImages",
    inputs=[
        DirectoryInput(),
        BoolInput("Use WCMatch glob expression", default=False),
        if_group(Condition.bool(1, False))(
            BoolInput("Recursive").with_docs("Iterate recursively over subdirectories.")
        ),
        if_group(Condition.bool(1, True))(
            TextInput("WCMatch Glob expression", default="**/*").with_docs(
                "For information on how to use WCMatch glob expressions, see [here](https://facelessuser.github.io/wcmatch/glob/)."
            ),
        ),
        BoolInput("Use limit", default=False),
        if_group(Condition.bool(4, True))(
            NumberInput("Limit", default=10).with_docs(
                "Limit the number of images to iterate over. This can be useful for testing the iterator without having to iterate over all images."
            )
        ),
    ],
    outputs=[
        ImageOutput(),
        DirectoryOutput("Directory", output_type="Input0"),
        TextOutput("Subdirectory Path"),
        TextOutput("Name"),
        NumberOutput(
            "Index",
            output_type="if Input4 { min(uint, Input5 - 1) } else { uint }",
        ),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 2, 3, 4]),
    node_type="newIterator",
)
def load_images_node(
    directory: str,
    use_glob: bool,
    is_recursive: bool,
    glob_str: str,
    use_limit: bool,
    limit: int,
) -> tuple[Iterator[tuple[np.ndarray, str, str, int]], str]:
    def load_image(path: str, index: int):
        img, img_dir, basename = load_image_node(path)
        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(img_dir, directory)
        return img, rel_path, basename, index

    supported_filetypes = get_available_image_formats()

    if not use_glob:
        glob_str = "**/*" if is_recursive else "*"

    just_image_files: list[str] = list_glob(directory, glob_str, supported_filetypes)
    if not len(just_image_files):
        raise FileNotFoundError(f"{directory} has no valid images.")

    if use_limit:
        just_image_files = just_image_files[:limit]

    return Iterator.from_list(just_image_files, load_image), directory
