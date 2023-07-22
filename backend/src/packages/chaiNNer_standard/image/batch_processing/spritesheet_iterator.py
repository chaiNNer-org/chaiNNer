from __future__ import annotations

from typing import List, Tuple

import numpy as np

from nodes.properties.inputs import ImageInput, IteratorInput, NumberInput
from nodes.properties.outputs import ImageOutput, NumberOutput
from nodes.utils.utils import get_h_w_c
from process import IteratorContext

from .. import batch_processing_group

SPRITESHEET_ITERATOR_INPUT_NODE_ID = "chainner:image:spritesheet_iterator_load"
SPRITESHEET_ITERATOR_OUTPUT_NODE_ID = "chainner:image:spritesheet_iterator_save"


@batch_processing_group.register(
    schema_id=SPRITESHEET_ITERATOR_INPUT_NODE_ID,
    name="Load Image (Iterator)",
    description="Outputs the sub-image and the index.",
    icon="MdSubdirectoryArrowRight",
    node_type="iteratorHelper",
    inputs=[IteratorInput().make_optional()],
    outputs=[
        ImageOutput(),
        NumberOutput("Overall Index", output_type="uint").with_docs(
            "A counter that starts at 0 and increments by 1 for each image."
        ),
    ],
    side_effects=True,
)
def iterator_helper_load_image_node(
    img: np.ndarray, index: int
) -> Tuple[np.ndarray, int]:
    return img, index


@batch_processing_group.register(
    schema_id=SPRITESHEET_ITERATOR_OUTPUT_NODE_ID,
    name="Append Image",
    description="Combines the image back into the spritesheet.",
    icon="CgExtensionAdd",
    node_type="iteratorHelper",
    inputs=[ImageInput()],
    outputs=[],
    side_effects=True,
)
def iterator_helper_append_image_node(
    img: np.ndarray, results: List[np.ndarray]
) -> None:
    results.append(img)


@batch_processing_group.register(
    schema_id="chainner:image:spritesheet_iterator",
    name="Spritesheet Iterator",
    description=[
        "Iterate over sub-images in a single image spritesheet.",
        "This iterator splits the image into tiles that it then runs your iterator chain on, and then recombines the tiles into a single image.",
    ],
    icon="MdLoop",
    node_type="iterator",
    inputs=[
        ImageInput("Spritesheet"),
        NumberInput(
            "Number of rows (height)",
            controls_step=1,
            minimum=1,
            default=1,
        ).with_docs(
            "The number of rows to split the image into. The height of the image must be a multiple of this number."
        ),
        NumberInput(
            "Number of columns (width)",
            controls_step=1,
            minimum=1,
            default=1,
        ).with_docs(
            "The number of columns to split the image into. The width of the image must be a multiple of this number."
        ),
    ],
    outputs=[ImageOutput()],
    default_nodes=[
        # TODO: Figure out a better way to do this
        {
            "schemaId": SPRITESHEET_ITERATOR_INPUT_NODE_ID,
        },
        {
            "schemaId": SPRITESHEET_ITERATOR_OUTPUT_NODE_ID,
        },
    ],
    side_effects=True,
)
async def spritesheet_iterator_node(
    sprite_sheet: np.ndarray,
    rows: int,
    columns: int,
    context: IteratorContext,
) -> np.ndarray:
    h, w, _ = get_h_w_c(sprite_sheet)
    assert (
        h % rows == 0
    ), "Height of sprite sheet must be a multiple of the number of rows"
    assert (
        w % columns == 0
    ), "Width of sprite sheet must be a multiple of the number of columns"

    img_loader_node_id = context.get_helper(SPRITESHEET_ITERATOR_INPUT_NODE_ID).id
    output_node_id = context.get_helper(SPRITESHEET_ITERATOR_OUTPUT_NODE_ID).id

    individual_h = h // rows
    individual_w = w // columns

    # Split sprite sheet into a single list of images
    img_list: List[np.ndarray] = []

    for row in range(rows):
        for col in range(columns):
            img_list.append(
                sprite_sheet[
                    row * individual_h : (row + 1) * individual_h,
                    col * individual_w : (col + 1) * individual_w,
                ]
            )

    results = []
    context.inputs.set_append_values(output_node_id, [results])

    def before(img: np.ndarray, index: int):
        context.inputs.set_values(img_loader_node_id, [img, index])

    await context.run(img_list, before)

    result_rows = []
    for i in range(rows):
        row = np.concatenate(results[i * columns : (i + 1) * columns], axis=1)
        result_rows.append(row)
    return np.concatenate(result_rows, axis=0)
