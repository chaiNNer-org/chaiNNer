from __future__ import annotations

import numpy as np

from nodes.impl.caption import CaptionPosition, add_caption
from nodes.properties.inputs import EnumInput, ImageInput, NumberInput, TextInput
from nodes.properties.outputs import ImageOutput

from .. import compositing_group


@compositing_group.register(
    schema_id="chainner:image:caption",
    name="添加标题",
    description="在图像的顶部或底部添加标题。",
    icon="MdVideoLabel",
    inputs=[
        ImageInput(),
        TextInput("标题"),
        NumberInput("大小", minimum=20, default=42, unit="px"),
        EnumInput(
            CaptionPosition,
            "位置",
            default=CaptionPosition.BOTTOM,
            label_style="inline",
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                // 此值由 `add_caption` 定义
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
    return add_caption(img, caption, size, position)
