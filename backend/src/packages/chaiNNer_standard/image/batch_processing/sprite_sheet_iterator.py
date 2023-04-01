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
    description="",
    icon="MdSubdirectoryArrowRight",
    node_type="iteratorHelper",
    inputs=[IteratorInput().make_optional()],
    outputs=[ImageOutput(), NumberOutput("Overall Index")],
    side_effects=True,
)
def ImageSpriteSheetIteratorLoadImageNode(
    img: np.ndarray, index: int
) -> Tuple[np.ndarray, int]:
    return img, index


@batch_processing_group.register(
    schema_id=SPRITESHEET_ITERATOR_OUTPUT_NODE_ID,
    name="Append Image",
    description="",
    icon="CgExtensionAdd",
    node_type="iteratorHelper",
    inputs=[ImageInput()],
    outputs=[],
    side_effects=True,
)
def ImageSpriteSheetIteratorAppendImageNode(
    img: np.ndarray, results: List[np.ndarray]
) -> None:
    results.append(img)


@batch_processing_group.register(
    schema_id="chainner:image:spritesheet_iterator",
    name="Spritesheet Iterator",
    description="Iterate over sub-images in a single image spritesheet.",
    icon="MdLoop",
    node_type="iterator",
    inputs=[
        ImageInput("Spritesheet"),
        NumberInput(
            "Number of rows (vertical)",
            controls_step=1,
            minimum=1,
            default=1,
        ),
        NumberInput(
            "Number of columns (horizontal)",
            controls_step=1,
            minimum=1,
            default=1,
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
)
async def ImageSpriteSheetIteratorNode(
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
