from __future__ import annotations

import os
from typing import List, Tuple

import numpy as np
from sanic.log import logger
from wcmatch import glob

from nodes.groups import Condition, if_group
from nodes.impl.image_formats import get_available_image_formats
from nodes.properties.inputs import BoolInput, DirectoryInput, IteratorInput, TextInput
from nodes.properties.outputs import (
    DirectoryOutput,
    ImageOutput,
    NumberOutput,
    TextOutput,
)
from process import IteratorContext

from .. import batch_processing_group
from ..io.load_image import load_image_node

IMAGE_ITERATOR_NODE_ID = "chainner:image:file_iterator_load"


def extension_filter(lst: List[str]) -> str:
    """generates a mcmatch.glob expression to filter files with specific extensions
    ex. {*,**/*}@(*.png|*.jpg|...)"""
    return "{*,**/*}@(*" + "|*".join(lst) + ")"


def list_glob(directory: str, globexpr: str, ext_filter: List[str]) -> List[str]:
    directory_expr = os.path.join(directory, globexpr)
    extension_expr = os.path.join(directory, extension_filter(ext_filter))

    filtered = glob.globfilter(
        glob.iglob(directory_expr, flags=glob.EXTGLOB | glob.BRACE),
        extension_expr,
        flags=glob.EXTGLOB | glob.BRACE,
    )

    return list(map(str, filtered))


@batch_processing_group.register(
    schema_id=IMAGE_ITERATOR_NODE_ID,
    name="Load Image (Iterator)",
    description="",
    icon="MdSubdirectoryArrowRight",
    node_type="iteratorHelper",
    inputs=[IteratorInput().make_optional()],
    outputs=[
        ImageOutput(),
        DirectoryOutput("Image Directory"),
        TextOutput("Subdirectory Path"),
        TextOutput("Image Name"),
        NumberOutput("Overall Index", output_type="uint"),
    ],
    side_effects=True,
)
def ImageFileIteratorLoadImageNode(path: str, root_dir: str, index: int) -> Tuple[np.ndarray, str, str, str, int]:
    img, img_dir, basename = load_image_node(path)

    # Get relative path from root directory passed by Iterator directory input
    rel_path = os.path.relpath(img_dir, root_dir)

    return img, root_dir, rel_path, basename, index


@batch_processing_group.register(
    schema_id="chainner:image:file_iterator",
    name="Image File Iterator",
    description="Iterate over all files in a directory and run the provided nodes on just the image files.",
    icon="MdLoop",
    node_type="iterator",
    inputs=[
        DirectoryInput(),
        BoolInput("Use glob expression", default=False),
        if_group(Condition.bool(1, False))(BoolInput("Recursive")),
        if_group(Condition.bool(1, True))(
            TextInput("Glob expression", default="{*,**/*}"),
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
)
async def ImageFileIteratorNode(
    directory: str,
    use_glob: bool,
    is_recursive: bool,
    glob_str: str,
    context: IteratorContext,
) -> None:
    logger.debug(f"Iterating over images in directory: {directory}")

    img_path_node_id = context.get_helper(IMAGE_ITERATOR_NODE_ID).id

    supported_filetypes = get_available_image_formats()

    if not use_glob:
        glob_str = "{*,**/*}" if is_recursive else "*"

    just_image_files: List[str] = list_glob(directory, glob_str, supported_filetypes)
    if not len(just_image_files):
        raise FileNotFoundError(f"{directory} has no valid images.")

    def before(filepath: str, index: int):
        context.inputs.set_values(img_path_node_id, [filepath, directory, index])

    await context.run(just_image_files, before)
