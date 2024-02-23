from __future__ import annotations

import numpy as np

from nodes.impl.color.color import Color
from nodes.impl.image_utils import as_target_channels
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput

from . import node_group


@node_group.register(
    schema_id="chainner:image:merge_transparency",
    name="合并透明度",
    description="将 RGB 和 Alpha（透明度）图像通道合并为 4 通道 RGBA 通道。",
    icon="MdCallMerge",
    inputs=[
        ImageInput("RGB", allow_colors=True),
        ImageInput("Alpha", allow_colors=True, channels=1),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def isImage(i: any) = match i { Image => true, _ => false };
                let anyImages = bool::or(isImage(Input0), isImage(Input1));

                if bool::not(anyImages) {
                    error("At least one input must be an image.")
                } else {
                    def getWidth(i: any) = match i { Image => i.width, _ => Image.width };
                    def getHeight(i: any) = match i { Image => i.height, _ => Image.height };

                    Image {
                        width: getWidth(Input0) & getWidth(Input1),
                        height: getHeight(Input0) & getHeight(Input1),
                    }
                }
            """,
            channels=4,
            assume_normalized=True,
        ).with_never_reason("RGB 和 Alpha 必须具有相同的大小。")
    ],
)
def merge_transparency_node(
    rgb: np.ndarray | Color,
    a: np.ndarray | Color,
) -> np.ndarray:
    start_shape = None

    # determine shape
    for i in rgb, a:
        if isinstance(i, np.ndarray):
            start_shape = (i.shape[0], i.shape[1])
            break

    if start_shape is None:
        raise ValueError(
            "至少一个输入必须是图像，但 RGB 和 Alpha 都是颜色。"
        )

    # check same size
    for i in rgb, a:
        if isinstance(i, np.ndarray):
            assert (
                i.shape[:2] == start_shape
            ), "所有通道图像必须具有相同的分辨率"

    def to_image(i: np.ndarray | Color) -> np.ndarray:
        if isinstance(i, np.ndarray):
            return i
        return i.to_image(start_shape[1], start_shape[0])

    rgb = as_target_channels(to_image(rgb), 3, narrowing=True)
    a = to_image(a)

    return np.dstack((rgb, a))
