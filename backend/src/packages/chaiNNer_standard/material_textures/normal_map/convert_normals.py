from __future__ import annotations

import numpy as np

import navi
from nodes.impl.image_utils import NormalMapType
from nodes.impl.normals.util import (
    XYZ,
    gr_to_xyz,
    octahedral_gr_to_xyz,
    xyz_to_bgr,
    xyz_to_octahedral_bgr,
)
from nodes.properties.inputs import EnumInput, ImageInput
from nodes.properties.outputs import ImageOutput

from .. import normal_map_group


@normal_map_group.register(
    schema_id="chainner:image:convert_normal_map",
    name="转换法线",
    description=[
        """在不同的法线图格式之间进行转换。仅使用输入图像的R和G通道。对于DirectX和OpenGL，输出法线图保证已归一化。""",
        "还支持与RTX Remix使用的八面体格式之间的转换。",
    ],
    icon="BsBoxArrowUpRight",
    inputs=[
        ImageInput("法线图", channels=[3, 4]),
        EnumInput(
            NormalMapType,
            label="从",
            label_style="inline",
            default=NormalMapType.DIRECTX,
            option_labels={
                NormalMapType.DIRECTX: "DirectX",
                NormalMapType.OPENGL: "OpenGL",
            },
        ),
        EnumInput(
            NormalMapType,
            label="到",
            label_style="inline",
            default=NormalMapType.OPENGL,
            option_labels={
                NormalMapType.DIRECTX: "DirectX",
                NormalMapType.OPENGL: "OpenGL",
                NormalMapType.OCTAHEDRAL: "八面体（RTX Remix）",
            },
        ),
    ],
    outputs=[
        ImageOutput(
            "法线图",
            image_type=navi.Image(
                width="Input0.width",
                height="Input0.height",
            ),
            channels=3,
        ),
    ],
)
def convert_normals_node(
    img: np.ndarray,
    from_type: NormalMapType,
    to_type: NormalMapType,
) -> np.ndarray:
    # Step 1: Read/decode the image to get the XYZ components of the normals

    # we define this as DirectX normals
    xyz: XYZ
    if from_type == NormalMapType.DIRECTX:
        xyz = gr_to_xyz(img)
    elif from_type == NormalMapType.OPENGL:
        xyz = gr_to_xyz(img)
        # OpenGL to DirectX
        _, y, _ = xyz
        np.negative(y, out=y)
    elif from_type == NormalMapType.OCTAHEDRAL:
        xyz = octahedral_gr_to_xyz(img)

    # Step 2: Convert/encode the XYZ components of the normals to BGR

    if to_type == NormalMapType.DIRECTX:
        return xyz_to_bgr(xyz)
    elif to_type == NormalMapType.OPENGL:
        # DirectX to OpenGL
        _, y, _ = xyz
        np.negative(y, out=y)
        return xyz_to_bgr(xyz)
    elif to_type == NormalMapType.OCTAHEDRAL:
        return xyz_to_octahedral_bgr(xyz)
