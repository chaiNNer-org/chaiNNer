from __future__ import annotations

import numpy as np

import navi
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from . import node_group


@node_group.register(
    schema_id="chainner:image:split_channels",
    name="独立RGBA",
    description=(
        "将图像通道分割成单独的通道。 "
        "通常用于分割 alpha（透明）层。"
    ),
    icon="MdCallSplit",
    inputs=[ImageInput()],
    outputs=[
        ImageOutput(
            "R Channel",
            image_type=navi.Image(size_as="Input0"),
            channels=1,
            assume_normalized=True,
        )
        .with_docs("红色通道。")
        .with_id(2),
        ImageOutput(
            "G Channel",
            image_type=navi.Image(size_as="Input0"),
            channels=1,
            assume_normalized=True,
        )
        .with_docs("绿色通道。")
        .with_id(1),
        ImageOutput(
            "B Channel",
            image_type=navi.Image(size_as="Input0"),
            channels=1,
            assume_normalized=True,
        )
        .with_docs("蓝色通道。")
        .with_id(0),
        ImageOutput(
            "A Channel",
            image_type=navi.Image(size_as="Input0"),
            channels=1,
            assume_normalized=True,
        ).with_docs("Alpha（透明蒙版）通道。"),
    ],
)
def separate_rgba_node(
    img: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    h, w, c = get_h_w_c(img)
    safe_out = np.ones((h, w), dtype=np.float32)

    if img.ndim == 2:
        return img, safe_out, safe_out, safe_out

    c = min(c, 4)

    out = []
    for i in range(c):
        out.append(img[:, :, i])
    for _ in range(4 - c):
        out.append(safe_out)

    return out[2], out[1], out[0], out[3]
