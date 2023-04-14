from __future__ import annotations

import numpy as np

from nodes.impl.normals.util import gr_to_xyz, xyz_to_bgr
from nodes.properties import expression
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput

from .. import normal_map_group


@normal_map_group.register(
    schema_id="chainner:image:normalize_normal_map",
    name="Normalize Normal Map",
    description="""Normalizes the given normal map.
            Only the R and G channels of the input image will be used to compute the unit vectors.""",
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput("Normal Map", channels=[3, 4]),
    ],
    outputs=[
        ImageOutput(
            "Normal Map",
            image_type=expression.Image(size_as="Input0"),
            channels=3,
        ),
    ],
)
def normalize_normal_map_node(img: np.ndarray) -> np.ndarray:
    """Takes a normal map and normalizes it"""

    return xyz_to_bgr(gr_to_xyz(img))
