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
    name="Normalize Normals",
    description=[
        "Normalizes the given normal map. Only the R and G channels of the input image will be used to compute the unit vectors.",
        "While the X and Y component will always be mapped from [-1, 1] to [0, 1] and saved as the R and G channels respectively, the B channel can be configured to contain different values.",
    ],
    icon="MdOutlineAutoFixHigh",
    inputs=[
        ImageInput("Normal Map", channels=[3, 4]),
        EnumInput(
            BChannel, "Output B", label_style="inline", default=BChannel.Z
        ).with_docs(
            "Determines the content of the B channel of the output normal map.",
            "- `Z`: Unlike the X and Y components which are in range [-1, 1], the Z component is guaranteed to be in the range [0, 1]. This allows us to directly use the Z component as the B channel.",
            "- `Z Mapped`: Just like the X and Y components, the Z component will be mapped to [0, 1] and stored as the B channel. Since the Z component is always >= 0, the B channel will be in the range [0.5, 1] ([128, 255])",
            "- `ONE`: The B channel will be 1 (255) everywhere.",
            "- `HALF`: The B channel will be 0.5 (128) everywhere.",
            "- `ZERO`: The B channel will be 0 everywhere.",
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
