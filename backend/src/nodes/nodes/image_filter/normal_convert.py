from __future__ import annotations

import numpy as np

from . import category as ImageFilterCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, EnumInput
from ...properties.outputs import ImageOutput
from ...properties import expression
from ...impl.image_utils import NormalMapType
from ...impl.normals.util import (
    gr_to_xyz,
    octahedral_gr_to_xyz,
    xyz_to_bgr,
    xyz_to_octahedral_bgr,
    XYZ,
)


@NodeFactory.register("chainner:image:convert_normal_map")
class ConvertNormalMap(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Convert between different normal map formats. Only the R and G
            channels of the input image will be used. For DirectX and OpenGL, the output normal map
            is guaranteed to be normalized."""
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
