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


def align_images(images: List[np.ndarray]) -> np.ndarray:
    center = np.mean(images, axis=0)
    center_h, center_w, center_c = get_h_w_c(center)
    aligned_images = []
    for image in images:
        h, w, c = get_h_w_c(image)
        diff_y, diff_x = (center_h - h) // 2, (center_w - w) // 2
        aligned_image = np.zeros_like(center)
        aligned_image[diff_y : (diff_y + h), diff_x : (diff_x + w)] = image
        aligned_images.append(aligned_image)
    return np.array(aligned_images)


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
    outputs=[ImageOutput()],
)
def z_stack(
    expression: Expression,
    *args: Union[np.ndarray, None],
) -> np.ndarray:
    """Align and evaluate images"""

    inputs: List[Union[np.ndarray, None]] = [*args]
    images = [x for x in inputs if x is not None]
    assert (
        2 <= len(images) <= 15
    ), f"Number of images must be between 2 and 15 ({len(images)})"

    aligned_images = align_images(images)

    if expression == Expression.MEAN:
        result = np.mean(aligned_images, axis=0)
    elif expression == Expression.MEDIAN:
        result = np.median(aligned_images, axis=0)
    elif expression == Expression.MIN:
        result = np.min(aligned_images, axis=0)
    elif expression == Expression.MAX:
        result = np.max(aligned_images, axis=0)
    else:
        assert False, f"Invalid expression '{expression}'"

    return result
