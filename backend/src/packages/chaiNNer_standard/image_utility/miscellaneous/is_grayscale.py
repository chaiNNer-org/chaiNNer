from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import BoolOutput

from .. import miscellaneous_group


@miscellaneous_group.register(
    schema_id="chainner:image:is_grayscale",
    name="Is Grayscale",
    description="Checks if the input image is grayscale by checking if all color channels are identical within a given tolerance.",
    icon="BsSquareHalf",
    inputs=[
        ImageInput().with_docs("Input image to check for grayscale."),
        SliderInput(
            "Tolerance", default=0, min=0, max=255, precision=0, step=1
        ).with_docs("Tolerance for channel differences."),
    ],
    outputs=[
        BoolOutput("Is Grayscale").with_docs(
            "True if the image is grayscale within the specified tolerance, False otherwise."
        ),
    ],
)
def is_grayscale_node(img: np.ndarray, tolerance: int = 0) -> bool:
    if img.ndim == 2 or img.shape[2] == 1:
        return True

    threshold = tolerance / 255.0

    diff_rg = np.abs(img[:, :, 0] - img[:, :, 1])
    diff_rb = np.abs(img[:, :, 0] - img[:, :, 2])

    return bool(np.all(diff_rg <= threshold) and np.all(diff_rb <= threshold))
