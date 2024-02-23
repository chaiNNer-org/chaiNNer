from __future__ import annotations

import numpy as np

from nodes.impl.color.color import Color
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput

from . import node_group


@node_group.register(
    schema_id="chainner:image:combine_rgba",
    name="合并RGBA",
    description=(
        "将给定通道合并在一起并返回 RGBA 图像。"
        " 所有通道图像必须是单通道图像。"
    ),
    icon="MdCallMerge",
    inputs=[
        ImageInput("R 通道", channels=1, allow_colors=True).with_docs(
            "红色通道。"
        ),
        ImageInput("G 通道", channels=1, allow_colors=True).with_docs(
            "绿色通道。"
        ),
        ImageInput("B 通道", channels=1, allow_colors=True).with_docs(
            "蓝色通道."
        ),
        ImageInput("A Channel", channels=1, allow_colors=True)
        .with_docs("Alpha（透明蒙版）通道。")
        .make_optional(),
    ],
    outputs=[
        ImageOutput(
            image_type="""
                def isImage(i: any) = match i { Image => true, _ => false };
                let anyImages = bool::or(isImage(Input0), isImage(Input1), isImage(Input2), isImage(Input3));

                if bool::not(anyImages) {
                    error("At least one channel must be an image.")
                } else {
                    def getWidth(i: any) = match i { Image => i.width, _ => Image.width };
                    def getHeight(i: any) = match i { Image => i.height, _ => Image.height };

                    Image {
                        width: getWidth(Input0) & getWidth(Input1) & getWidth(Input2) & getWidth(Input3),
                        height: getHeight(Input0) & getHeight(Input1) & getHeight(Input2) & getHeight(Input3),
                    }
                }
            """,
            channels=4,
            assume_normalized=True,
        ).with_never_reason("所有输入通道必须具有相同的大小。")
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
            "至少一个通道必须是图像，但所有给定通道都是颜色。"
        )

    # check same size
    for i in inputs:
        if isinstance(i, np.ndarray):
            assert (
                i.shape[:2] == start_shape
            ), "所有通道图像必须具有相同的分辨率"

    channels = [
        (
            i
            if isinstance(i, np.ndarray)
            else i.to_image(width=start_shape[1], height=start_shape[0])
        )
        for i in inputs
    ]

    return np.stack(channels, axis=2)
