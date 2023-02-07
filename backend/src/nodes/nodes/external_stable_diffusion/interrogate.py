from __future__ import annotations

import numpy as np

from . import category as ExternalStableDiffusionCategory
from ...impl.external_stable_diffusion import (
    STABLE_DIFFUSION_INTERROGATE_URL,
    post,
    encode_base64_image,
)
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import TextOutput


@NodeFactory.register("chainner:external_stable_diffusion:interrograte")
class Interrogate(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Use Automatic1111 to get a description of an image"
        self.inputs = [
            ImageInput(),
        ]
        self.outputs = [
            TextOutput("Text"),
        ]

        self.category = ExternalStableDiffusionCategory
        self.name = "CLIP Interrogate"
        self.icon = "MdTextFields"
        self.sub = "Automatic1111"

    def run(self, image: np.ndarray) -> str:
        request_data = {
            "image": encode_base64_image(image),
        }
        response = post(url=STABLE_DIFFUSION_INTERROGATE_URL, json_data=request_data)
        return response["caption"]
