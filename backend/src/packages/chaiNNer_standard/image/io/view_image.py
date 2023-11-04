from __future__ import annotations

from typing import TYPE_CHECKING

from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import LargeImageOutput

from .. import io_group

if TYPE_CHECKING:
    import numpy as np


@io_group.register(
    schema_id="chainner:image:view",
    name="View Image",
    description="See an inline preview of the image in the editor.",
    icon="BsEyeFill",
    inputs=[ImageInput()],
    outputs=[
        LargeImageOutput(
            "Preview",
            image_type="Input0",
            has_handle=False,
            assume_normalized=True,
        ),
    ],
    side_effects=True,
)
def view_image_node(img: np.ndarray):
    return img
