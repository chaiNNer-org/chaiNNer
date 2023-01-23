from __future__ import annotations

from sanic.log import logger

from . import category as RESTCategory
from ...impl.rest import STABLE_DIFFUSION_INTERROGATE_URL, post_async, encode_base64_image
from ...node_base import AsyncNodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from ...properties.outputs import TextOutput


@NodeFactory.register("chainner:rest:sd_interrogate")
class Interrogate(AsyncNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Use an external Stable Diffusion service to get a description of an image"
        self.inputs = [
            ImageInput(),
        ]
        self.outputs = [
            TextOutput("Text"),
        ]

        self.category = RESTCategory
        self.name = "CLIP Interrogate"
        self.icon = "BsFillImageFill"
        self.sub = "Stable Diffusion"

    async def run_async(self, image: np.ndarray) -> str:
        request_data = {
            'image': encode_base64_image(image),
        }
        response = await post_async(url=STABLE_DIFFUSION_INTERROGATE_URL, json_data=request_data)
        return response['caption']
