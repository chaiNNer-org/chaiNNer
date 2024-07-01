from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from wcmatch import glob

from api import Generator, IteratorOutputInfo
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

from .. import batch_processing_group
from ..io.load_image import load_image_node


def extension_filter(lst: list[str]) -> str:
    """generates a mcmatch.glob expression to filter files with specific extensions
    ex. {*,**/*}@(*.png|*.jpg|...)"""
    return "**/*@(" + "|".join(lst) + ")"


def list_glob(directory: Path, globexpr: str, ext_filter: list[str]) -> list[Path]:
    extension_expr = extension_filter(ext_filter)

    flags = (
        glob.EXTGLOB
        | glob.BRACE
        | glob.GLOBSTAR
        | glob.NEGATE
        | glob.DOTGLOB
        | glob.NEGATEALL
    )

    foo = list(glob.iglob(globexpr, root_dir=directory, flags=flags))

    filtered = glob.globfilter(
        foo,
        extension_expr,
        flags=flags | glob.IGNORECASE,
    )

    return [
        Path(x)
        for x in sorted(
            {str(directory / f) for f in filtered},
            key=alphanumeric_sort,
        )
    ]


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
        BoolInput("Use limit", default=False).with_id(4),
        if_group(Condition.bool(4, True))(
            NumberInput("Limit", default=10, min=1)
            .with_docs(
                "Limit the number of images to iterate over. This can be useful for testing the iterator without having to iterate over all images."
            )
            .with_id(5)
        ),
        BoolInput("Stop on first error", default=False).with_docs(
            "Instead of collecting errors and throwing them at the end of processing, stop iteration and throw an error as soon as one occurs.",
            hint=True,
        ),
    ],
    outputs=[
        ImageOutput(),
        DirectoryOutput("Directory", output_type="Input0"),
        TextOutput("Subdirectory Path"),
        TextOutput("Name"),
        NumberOutput("Index", output_type="min(uint, max(0, IterOutput0.length - 1))"),
    ],
    iterator_outputs=IteratorOutputInfo(
        outputs=[0, 2, 3, 4],
        length_type="if Input4 { min(uint, Input5) } else { uint }",
    ),
    kind="generator",
    side_effects=True,
)
def load_images_node(
    directory: Path,
    use_glob: bool,
    is_recursive: bool,
    glob_str: str,
    use_limit: bool,
    limit: int,
    fail_fast: bool,
) -> tuple[Generator[tuple[np.ndarray, str, str, int]], Path]:
    def load_image(path: Path, index: int):
        img, img_dir, basename = load_image_node(path)
        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(img_dir, directory)
        return img, rel_path, basename, index

    supported_filetypes = get_available_image_formats()

    if not use_glob:
        glob_str = "**/*" if is_recursive else "*"

    just_image_files = list_glob(directory, glob_str, supported_filetypes)
    if not len(just_image_files):
        raise FileNotFoundError(f"{directory} has no valid images.")

    if use_limit:
        just_image_files = just_image_files[:limit]

    return Generator.from_list(just_image_files, load_image, fail_fast), directory
