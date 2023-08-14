from __future__ import annotations

import numpy as np

from nodes.impl.color.color import Color
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
        ImageInput("R Channel", channels=1, allow_colors=True).with_docs(
            "The red channel."
        ),
        ImageInput("G Channel", channels=1, allow_colors=True).with_docs(
            "The green channel."
        ),
        ImageInput("B Channel", channels=1, allow_colors=True).with_docs(
            "The blue channel."
        ),
        ImageInput("A Channel", channels=1, allow_colors=True)
        .with_docs("The alpha (transparency mask) channel.")
        .make_optional(),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                let anyImages = bool::or(Input0 == Image, Input1 == Image, Input2 == Image, Input3 == Image);

                def getWidth(i: any) = match i { Image => i.width, _ => Image.width };
                def getHeight(i: any) = match i { Image => i.height, _ => Image.height };

                let valid = if anyImages { any } else { never };

                valid & Image {
                    width: getWidth(Input0) & getWidth(Input1) & getWidth(Input2) & getWidth(Input3),
                    height: getHeight(Input0) & getHeight(Input1) & getHeight(Input2) & getHeight(Input3),
                }
            """,
            channels=4,
            assume_normalized=True,
        ).with_never_reason(
            "All input channels must have the same size, and at least one input channel must be an image."
        )
    ],
)
def combine_rgba_node(
    img_r: np.ndarray | Color,
    img_g: np.ndarray | Color,
    img_b: np.ndarray | Color,
    img_a: np.ndarray | Color | None,
) -> np.ndarray:
    if img_a is None:
        img_a = Color.gray(1)

    start_shape = None

    # determine shape
    inputs = (img_b, img_g, img_r, img_a)
    for i in inputs:
        if isinstance(i, np.ndarray):
            start_shape = (i.shape[0], i.shape[1])
            break

    if start_shape is None:
        raise ValueError(
            "At least one channels must be an image, but all given channels are colors."
        )

    # check same size
    for i in inputs:
        if isinstance(i, np.ndarray):
            assert (
                i.shape[:2] == start_shape
            ), "All channel images must have the same resolution"

    channels = [
        (
            i
            if isinstance(i, np.ndarray)
            else i.to_image(width=start_shape[1], height=start_shape[0])
        )
        for i in inputs
    ]

    return np.stack(channels, axis=2)
