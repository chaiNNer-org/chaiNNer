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

        # Chop off alpha channel if present
        img = img[:, :, :3]
        # bgr to rgb
        img = img[..., ::-1]
        img = (img * 255).astype(np.uint8)

        if (from_type == NormalMapType.DIRECTX and to_type == NormalMapType.OPENGL) or (
            from_type == NormalMapType.OPENGL and to_type == NormalMapType.DIRECTX
        ):
            img = LightspeedOctahedralConverter.ogl_to_dx(img)
        if from_type == NormalMapType.DIRECTX and to_type == NormalMapType.OCTAHEDRAL:
            img = LightspeedOctahedralConverter.convert_dx_to_octahedral(img)
        if from_type == NormalMapType.OPENGL and to_type == NormalMapType.OCTAHEDRAL:
            img = LightspeedOctahedralConverter.convert_ogl_to_octahedral(img)
        return (img[..., ::-1] / 255).astype(np.float32)
