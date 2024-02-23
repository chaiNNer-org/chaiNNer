from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import LargeImageOutput

from .. import io_group


@io_group.register(
    schema_id="chainner:image:view",
    name="查看图像",
    description="在编辑器中查看图像的内联预览。",
    icon="BsEyeFill",
    inputs=[ImageInput("图像")],
    outputs=[
        LargeImageOutput(
            "预览",
            image_type="Input0",
            has_handle=False,
            assume_normalized=True,
        ),
    ],
    side_effects=True,
)
def view_image_node(img: np.ndarray):
    return img
