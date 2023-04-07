from __future__ import annotations

from typing import Union

import numpy as np

from nodes.properties import expression
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput

from . import node_group


@node_group.register(
    schema_id="chainner:image:combine_rgba",
    name="Combine RGBA",
    description=(
        "Merges the given channels together and returns an RGBA image."
        " All channel images must be a single channel image."
    ),
    icon="MdCallMerge",
    inputs=[
        ImageInput("R Channel", channels=1),
        ImageInput("G Channel", channels=1),
        ImageInput("B Channel", channels=1),
        ImageInput("A Channel", channels=1).make_optional(),
    ],
    outputs=[
        ImageOutput(
            image_type=expression.Image(
                width="Input0.width & Input1.width & Input2.width & match Input3 { Image as i => i.width, _ => any }",
                height="Input0.height & Input1.height & Input2.height & match Input3 { Image as i => i.height, _ => any }",
            ),
            channels=4,
            assume_normalized=True,
        ).with_never_reason(
            "The input channels have different sizes but must all be the same size."
        )
    ],
)
def combine_rgba_node(
    img_r: np.ndarray,
    img_g: np.ndarray,
    img_b: np.ndarray,
    img_a: Union[np.ndarray, None],
) -> np.ndarray:
    start_shape = img_r.shape[:2]

    for im in img_g, img_b, img_a:
        if im is not None:
            assert (
                im.shape[:2] == start_shape
            ), "All channel images must have the same resolution"

    channels = [
        img_b,
        img_g,
        img_r,
        img_a if img_a is not None else np.ones(start_shape, dtype=np.float32),
    ]

    return np.stack(channels, axis=2)
