from __future__ import annotations

from typing import Tuple

import numpy as np

from ...impl.pil_utils import InterpolationMethod, resize
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties import expression
from ...properties.inputs import ImageInput
from ...properties.outputs import ImageOutput
from ...utils.utils import get_h_w_c
from . import category


def get_size(img: np.ndarray) -> Tuple[int, int]:
    h, w, _ = get_h_w_c(img)
    return w, h


def metal_to_spec(
    albedo: np.ndarray,
    metal: np.ndarray,
    roughness: np.ndarray | None,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    assert get_h_w_c(albedo)[2] == 3, "Expected the albedo map to be an RGB image"

    # This uses the conversion method described here:
    # https://marmoset.co/posts/pbr-texture-conversion/
    metal3 = np.dstack((metal,) * 3)
    metal3_inv = 1 - metal3

    albedo_size = get_size(albedo)
    metal_size = get_size(metal)

    if metal_size == albedo_size:
        metal3_inv_scaled = metal3_inv
    else:
        metal3_inv_scaled = resize(metal3_inv, albedo_size, InterpolationMethod.LANCZOS)
    diff = albedo * metal3_inv_scaled

    if metal_size == albedo_size:
        scaled_albedo = albedo
    else:
        scaled_albedo = resize(albedo, metal_size, InterpolationMethod.LANCZOS)
    spec = metal3 * scaled_albedo + metal3_inv * 0.22

    if roughness is None:
        gloss = np.zeros((1, 1), np.float32) + 0.5
    else:
        gloss = 1 - roughness

    return diff, spec, gloss


@NodeFactory.register("chainner:image:metal_to_specular")
class MetalToSpecular(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Converts a Metal/Roughness material into a Specular/Gloss material."
        )
        self.inputs = [
            ImageInput("Albedo", channels=[3, 4]),
            ImageInput("Metal", channels=1),
            ImageInput("Roughness", channels=1).make_optional(),
        ]
        self.outputs = [
            ImageOutput("Diffuse", image_type="Input0"),
            ImageOutput(
                "Specular",
                image_type=expression.Image(size_as="Input1"),
                channels=3,
            ),
            ImageOutput(
                "Gloss",
                image_type="""
                    match Input2 {
                        Image as i => i,
                        null => Image { width: 1, height: 1, channels: 1 }
                    }
                """,
                channels=1,
            ),
        ]
        self.category = category
        self.name = "Metal to Specular"
        self.icon = "MdChangeCircle"
        self.sub = "Conversion"

    def run(
        self,
        albedo: np.ndarray,
        metal: np.ndarray,
        roughness: np.ndarray | None,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        albedo_channels = get_h_w_c(albedo)[2]
        if albedo_channels == 4:
            albedo_alpha = albedo[:, :, 3]
            albedo = albedo[:, :, :3]
        else:
            albedo_alpha = None

        diff, spec, gloss = metal_to_spec(albedo, metal, roughness)

        if albedo_alpha is not None:
            diff = np.dstack((diff, albedo_alpha))

        return diff, spec, gloss
