from __future__ import annotations

import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, EnumInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...impl.image_utils import NormalMapType
from ...impl.normals.nvidia.LightspeedOctahedralConverter import (
    LightspeedOctahedralConverter,
)
from ...impl.normals.util import gr_to_xyz, xyz_to_bgr


@NodeFactory.register("chainner:image:convert_normal_map")
class SpecularToMetal(NodeBase):
    def __init__(self):
        super().__init__()
        self.inputs = [
            ImageInput("Normal Map", channels=[3, 4]),
            EnumInput(
                NormalMapType,
                label="From",
                default_value=NormalMapType.DIRECTX,
                option_labels={
                    NormalMapType.DIRECTX: "DirectX",
                    NormalMapType.OPENGL: "OpenGL",
                },
            ),
            EnumInput(
                NormalMapType,
                label="To",
                default_value=NormalMapType.OPENGL,
                option_labels={
                    NormalMapType.DIRECTX: "DirectX",
                    NormalMapType.OPENGL: "OpenGL",
                    NormalMapType.OCTAHEDRAL: "Octahedral (RTX Remix)",
                },
            ),
        ]
        self.outputs = [
            ImageOutput(
                "Normal Map",
                image_type=expression.Image(
                    width="Input0.width",
                    height="Input0.height",
                ),
                channels=3,
            ),
        ]
        self.category = ImageFilterCategory
        self.name = "Convert Normals"
        self.icon = "BsBoxArrowUpRight"
        self.sub = "Normal Map"

    def run(
        self,
        img: np.ndarray,
        from_type: NormalMapType,
        to_type: NormalMapType,
    ) -> np.ndarray:
        if from_type == to_type:
            return img

        normal = np.stack(gr_to_xyz(img), axis=2)

        if (from_type == NormalMapType.DIRECTX and to_type == NormalMapType.OPENGL) or (
            from_type == NormalMapType.OPENGL and to_type == NormalMapType.DIRECTX
        ):
            normal = LightspeedOctahedralConverter.ogl_to_dx(normal)
        if from_type == NormalMapType.DIRECTX and to_type == NormalMapType.OCTAHEDRAL:
            normal = LightspeedOctahedralConverter.convert_dx_to_octahedral(normal)
        if from_type == NormalMapType.OPENGL and to_type == NormalMapType.OCTAHEDRAL:
            normal = LightspeedOctahedralConverter.convert_ogl_to_octahedral(normal)
        return xyz_to_bgr(np.split(normal, 3, axis=2))
