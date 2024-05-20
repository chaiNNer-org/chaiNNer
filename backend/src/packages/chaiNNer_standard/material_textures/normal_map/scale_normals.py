from __future__ import annotations

import numpy as np

import navi
from nodes.impl.normals.addition import AdditionMethod, strengthen_normals
from nodes.impl.normals.util import xyz_to_bgr
from nodes.properties.inputs import EnumInput, ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput

from .. import normal_map_group


@normal_map_group.register(
    schema_id="chainner:image:strengthen_normals",
    name="Scale Normals",
    description=[
        "Strengths or weakens the normals in the given normal map. Only the R and G channels of the input image will be used. The output normal map is guaranteed to be normalized.",
        "Conceptually, this node is equivalent to `chainner:image:add_normals` with the strength of the second normal map set to 0.",
    ],
    icon="MdExpand",
    inputs=[
        ImageInput("Normal Map", channels=[3, 4]),
        SliderInput("Strength", max=400, default=100),
        EnumInput(
            AdditionMethod,
            label="Method",
            default=AdditionMethod.PARTIAL_DERIVATIVES,
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
def scale_normals_node(
    n: np.ndarray, strength: int, method: AdditionMethod
) -> np.ndarray:
    return xyz_to_bgr(strengthen_normals(method, n, strength / 100))
