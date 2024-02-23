from __future__ import annotations

from enum import Enum

import numpy as np

import navi
from nodes.impl.normals.util import gr_to_xyz, xyz_to_bgr
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from .. import normal_map_group


class BChannel(Enum):
    Z = 0
    Z_MAPPED = 1
    ZERO = 2
    HALF = 3
    ONE = 4


    @normal_map_group.register(
    schema_id="chainner:image:normalize_normal_map",
    name="法线图归一化",
    description=[
        "归一化给定的法线图。仅使用输入图像的R和G通道来计算单位向量。",
        "虽然X和Y分量将始终从[-1,1]映射到[0,1]并保存为R和G通道，但B通道可以配置为包含不同的值。",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput("法线图", channels=[3, 4]),
        EnumInput(
            BChannel, "输出B", label_style="inline", default=BChannel.Z
        ).with_docs(
            "确定输出法线图的B通道的内容。",
            "- `Z`: 与始终在范围[-1,1]内的X和Y分量不同，Z分量保证在范围[0,1]内。这使我们可以直接将Z分量用作B通道。",
            "- `Z Mapped`: 与X和Y分量一样，Z分量将被映射到[0,1]并存储为B通道。由于Z分量始终>=0，B通道将在范围[0.5,1]内（[128,255]）",
            "- `ONE`: B通道将在所有位置上都为1（255）。",
            "- `HALF`: B通道将在所有位置上都为0.5（128）。",
            "- `ZERO`: B通道将在所有位置上都为0。",
        ),
    ],
    outputs=[
        ImageOutput(
            "Normal Map",
            image_type=navi.Image(size_as="Input0"),
            channels=3,
        ),
    ],
)
def normalize_normals_node(img: np.ndarray, b: BChannel) -> np.ndarray:
    result = xyz_to_bgr(gr_to_xyz(img))

    if b == BChannel.Z_MAPPED:
        result[:, :, 0] = (result[:, :, 0] + 1) / 2
    elif b == BChannel.ZERO:
        result[:, :, 0] = 0
    elif b == BChannel.HALF:
        result[:, :, 0] = 0.5
    elif b == BChannel.ONE:
        result[:, :, 0] = 1
    elif b == BChannel.Z:
        pass

    return result
