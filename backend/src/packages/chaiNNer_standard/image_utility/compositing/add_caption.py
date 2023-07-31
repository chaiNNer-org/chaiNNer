from __future__ import annotations

import numpy as np

from nodes.impl.caption import CaptionPosition, add_caption
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput, TextInput
from nodes.properties.outputs import ImageOutput

from .. import compositing_group


@compositing_group.register(
    schema_id="chainner:image:caption",
    name="Add Caption",
    description="Add a caption to the top or bottom of an image.",
    icon="MdVideoLabel",
    inputs=[
        ImageInput(),
        TextInput("Caption"),
        NumberInput("Caption Size", minimum=20, default=42, unit="px"),
        EnumInput(CaptionPosition, default_value=CaptionPosition.BOTTOM),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                // this value is defined by `add_caption`
                let captionHeight = Input2;
                Image {
                    width: Input0.width,
                    height: Input0.height + captionHeight,
                    channels: Input0.channels,
                }
                """,
            assume_normalized=True,
        )
    ],
)
def add_caption_node(
    img: np.ndarray, caption: str, size: int, position: CaptionPosition
) -> np.ndarray:
    """Add caption an image"""

    return add_caption(img, caption, size, position)
