from __future__ import annotations

import cv2
import numpy as np

import navi
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from . import node_group


@node_group.register(
    schema_id="chainner:image:merge_channels",
    name="合并通道",
    description=(
        "将图像通道合并成一个包含≤4通道的图像。"
        "通常用于将图像与alpha层合并。"
    ),
    icon="MdCallMerge",
    inputs=[
        ImageInput("通道 A"),
        ImageInput("通道 B").make_optional(),
        ImageInput("通道 C").make_optional(),
        ImageInput("通道 D").make_optional(),
    ],
    outputs=[
        ImageOutput(
            image_type=navi.Image(
                size_as="Input0",
                channels="""
                    match (
                        Input0.channels
                        + match Input1 { Image as i => i.channels, _ => 0 }
                        + match Input2 { Image as i => i.channels, _ => 0 }
                        + match Input3 { Image as i => i.channels, _ => 0 }
                    ) {
                        1 => 1,
                        2 | 3 => 3,
                        int(4..) => 4
                    }
                    """,
            )
        )
    ],
    deprecated=True,
)
def merge_channels_node(
    im1: np.ndarray,
    im2: np.ndarray | None,
    im3: np.ndarray | None,
    im4: np.ndarray | None,
) -> np.ndarray:
    start_shape = im1.shape[:2]

    for im in im2, im3, im4:
        if im is not None:
            assert (
                im.shape[:2] == start_shape
            ), "所有要合并的图像必须具有相同的分辨率"

    imgs = []
    for img in im1, im2, im3, im4:
        if img is not None:
            imgs.append(img)

    for idx, img in enumerate(imgs):
        if img.ndim == 2:
            imgs[idx] = np.expand_dims(img, axis=2)

    img = np.concatenate(imgs, axis=2)

    # ensure output is safe number of channels
    _, _, c = get_h_w_c(img)
    if c == 2:
        b, g = cv2.split(img)
        img = cv2.merge((b, g, g))
    elif c > 4:
        img = img[:, :, :4]

    return img
