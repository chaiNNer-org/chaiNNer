from __future__ import annotations

from typing import Tuple

import numpy as np

from ...impl.pil_utils import InterpolationMethod, resize
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput, SliderInput
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c
from . import category as ImageUtilityCategory


def get_size(img: np.ndarray) -> Tuple[int, int]:
    h, w, _ = get_h_w_c(img)
    return w, h


def spec_to_metal(
    diff: np.ndarray,
    spec: np.ndarray,
    gloss: np.ndarray,
    metallic_min: float,
    metallic_max: float,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    assert get_h_w_c(diff)[2] == 3, "Expected the diffuse map to be an RGB image"
    assert get_h_w_c(spec)[2] == 3, "Expected the specular map to be an RGB image"

    metallic_diff = (
        0.0001 if metallic_min == metallic_max else metallic_max - metallic_min
    )

    # Metal is approximated using the magnitude of the specular map.

    spec_max = np.maximum(spec[:, :, 0], np.maximum(spec[:, :, 1], spec[:, :, 2]))
    metal = np.clip((spec_max - metallic_min) / metallic_diff, 0, 1)

    # This uses the conversion method described here:
    # https://marmoset.co/posts/pbr-texture-conversion/

    diff_size = get_size(diff)
    spec_size = get_size(spec)

    if diff_size == spec_size:
        sped_scaled = spec
        metal_scaled = metal
    else:
        # to prevent color bleeding from non-metal parts of the specular map,
        # we apply the metal map as alpha and resize before combining with diffuse
        scaled = resize(
            np.dstack((spec, metal)), diff_size, InterpolationMethod.LANCZOS
        )
        sped_scaled: np.ndarray = scaled[:, :, 0:3]
        metal_scaled: np.ndarray = scaled[:, :, 3]
    metal3_scaled = np.dstack((metal_scaled,) * 3)
    albedo = metal3_scaled * sped_scaled + (1 - metal3_scaled) * diff

    roughness = 1 - gloss

    return albedo, metal, roughness


@NodeFactory.register("chainner:image:specular_to_metal")
class SpecularToMetal(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Converts a Specular/Gloss material into a Metal/Roughness material."
        )
        self.inputs = [
            ImageInput("Diffuse", channels=[3, 4]),
            ImageInput("Specular", channels=3),
            ImageInput("Gloss", channels=1),
            SliderInput(
                "Metallic Min",
                minimum=0,
                maximum=100,
                default=23,
                precision=1,
                slider_step=1,
            ),
            SliderInput(
                "Metallic Max",
                minimum=0,
                maximum=100,
                default=30,
                precision=1,
                slider_step=1,
            ),
        ]
        self.outputs = [
            ImageOutput("Albedo", image_type="Input0"),
            ImageOutput(
                "Metal",
                image_type=expression.Image(size_as="Input1"),
                channels=1,
            ),
            ImageOutput("Roughness", image_type="Input2", channels=1),
        ]
        self.category = ImageUtilityCategory
        self.name = "Specular to Metal"
        self.icon = "MdChangeCircle"
        self.sub = "Conversion"

    def run(
        self,
        diff: np.ndarray,
        spec: np.ndarray,
        gloss: np.ndarray,
        metallic_min: float,
        metallic_max: float,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        metallic_min /= 100
        metallic_max /= 100

        diff_channels = get_h_w_c(diff)[2]

        if diff_channels == 4:
            diff_alpha = diff[:, :, 3]
            diff = diff[:, :, :3]
        else:
            diff_alpha = None

        albedo, metal, roughness = spec_to_metal(
            diff, spec, gloss, metallic_min, metallic_max
        )

        if diff_alpha is not None:
            albedo = np.dstack((albedo, diff_alpha))

        return albedo, metal, roughness
