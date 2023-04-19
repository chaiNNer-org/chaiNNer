from __future__ import annotations

from enum import Enum
from typing import List, Union

import numpy as np

from nodes.group import group
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import ALPHABET, get_h_w_c

from .. import compositing_group


class Expression(Enum):
    MEDIAN = "median"
    MEAN = "mean"
    MIN = "minimum"
    MAX = "maximum"


@compositing_group.register(
    schema_id="chainner:image:z_stack",
    name="Z-Stack Images",
    description="""Aligns multiple images and evaluates them in relation to each other.""",
    icon="BsLayersHalf",
    inputs=[
        EnumInput(Expression),
        ImageInput("Image A"),
        ImageInput("Image B"),
        group("optional-list")(
            *[
                ImageInput(f"Image {letter}").make_optional()
                for letter in ALPHABET[2:14]
            ],
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def conv(i: Image | null) = match i { Image => i, _ => any };

                Input1 & Input2
                    & conv(Input3)
                    & conv(Input4)
                    & conv(Input5)
                    & conv(Input6)
                    & conv(Input7)
                    & conv(Input8)
                    & conv(Input9)
                    & conv(Input10)
                    & conv(Input11)
                    & conv(Input12)
                    & conv(Input13)
                    & conv(Input14)
            """
        ).with_never_reason(
            "All input images much have the same size and number of channels."
        ),
    ],
)
def z_stack(
    expression: Expression,
    *inputs: np.ndarray | None,
) -> np.ndarray:
    """Align and evaluate images"""

    images = [x for x in inputs if x is not None]
    assert (
        2 <= len(images) <= 15
    ), f"Number of images must be between 2 and 15 ({len(images)})"

    assert all(
        get_h_w_c(image) == get_h_w_c(images[0]) for image in images
    ), "All images must have the same dimensions and channels"

    if expression == Expression.MEAN:
        result = np.mean(images, axis=0)
    elif expression == Expression.MEDIAN:
        result = np.median(images, axis=0)
    elif expression == Expression.MIN:
        result = np.min(images, axis=0)
    elif expression == Expression.MAX:
        result = np.max(images, axis=0)
    else:
        assert False, f"Invalid expression '{expression}'"

    return result
