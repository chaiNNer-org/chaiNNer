from __future__ import annotations

import os
from pathlib import Path
from typing import List, Tuple

import numpy as np
from sanic.log import logger
from wcmatch import glob

from nodes.groups import Condition, if_group
from nodes.impl.image_formats import get_available_image_formats
from nodes.properties.inputs import (
    BoolInput,
    DirectoryInput,
    IteratorInput,
    NumberInput,
    TextInput,
)
from nodes.properties.outputs import (
    DirectoryOutput,
    ImageOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import alphanumeric_sort
from process import IteratorContext

from .. import batch_processing_group
from ..io.load_image import load_image_node

IMAGE_ITERATOR_NODE_ID = "chainner:image:file_iterator_load"


def extension_filter(lst: List[str]) -> str:
    """generates a mcmatch.glob expression to filter files with specific extensions
    ex. {*,**/*}@(*.png|*.jpg|...)"""
    return "**/*@(" + "|".join(lst) + ")"


def list_glob(directory: str, globexpr: str, ext_filter: List[str]) -> List[str]:
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
    schema_id=IMAGE_ITERATOR_NODE_ID,
    name="Load Image (Iterator)",
    description="Loads each image file in the directory and outputs the image, directory, subdirectory, filename, and the index.",
    icon="MdSubdirectoryArrowRight",
    node_type="iteratorHelper",
    inputs=[IteratorInput().make_optional()],
    outputs=[
        ImageOutput(),
        DirectoryOutput("Image Directory"),
        TextOutput("Subdirectory Path"),
        TextOutput("Image Name"),
        NumberOutput("Overall Index", output_type="uint").with_docs(
            "A counter that starts at 0 and increments by 1 for each image."
        ),
    ],
    side_effects=True,
)
def iterator_helper_load_image_node(
    path: str, root_dir: str, index: int
) -> Tuple[np.ndarray, str, str, str, int]:
    img, img_dir, basename = load_image_node(path)

    # Get relative path from root directory passed by Iterator directory input
    rel_path = os.path.relpath(img_dir, root_dir)

    return img, root_dir, rel_path, basename, index


@batch_processing_group.register(
    schema_id="chainner:image:file_iterator",
    name="Image File Iterator",
    description=[
        "Iterate over all files in a directory/folder (batch processing) and run the provided nodes on just the image files. Supports the same file types as `chainner:image:load`.",
        "Optionally, you can toggle whether to iterate recursively (subdirectories) or use a glob expression to filter the files.",
    ],
    icon="MdLoop",
    node_type="iterator",
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
    outputs=[],
    default_nodes=[
        # TODO: Figure out a better way to do this
        {
            "schemaId": IMAGE_ITERATOR_NODE_ID,
        },
    ],
    side_effects=True,
    see_also=[
        "chainner:image:load",
    ],
)
async def image_file_iterator_node(
    directory: str,
    use_glob: bool,
    is_recursive: bool,
    glob_str: str,
    use_limit: bool,
    limit: int,
    context: IteratorContext,
) -> None:
    logger.debug(
        f"Iterating over images in directory: {directory}, {use_glob} {glob_str} {is_recursive}"
    )

    img_path_node_id = context.get_helper(IMAGE_ITERATOR_NODE_ID).id

    supported_filetypes = get_available_image_formats()

    if not use_glob:
        glob_str = "**/*" if is_recursive else "*"

    just_image_files: List[str] = list_glob(directory, glob_str, supported_filetypes)
    if not len(just_image_files):
        raise FileNotFoundError(f"{directory} has no valid images.")

    if use_limit:
        just_image_files = just_image_files[:limit]

    def before(filepath: str, index: int):
        context.inputs.set_values(img_path_node_id, [filepath, directory, index])

    await context.run(just_image_files, before)
