from __future__ import annotations

import numpy as np

from . import category as RESTCategory
from ...impl.rest import (
    decode_base64_image,
    SamplerName,
    STABLE_DIFFUSION_IMG2IMG_URL,
    post_async,
    encode_base64_image,
)
from ...node_base import AsyncNodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    TextInput,
    NumberInput,
    EnumInput,
    ImageInput,
)
from ...properties.outputs import LargeImageOutput


@NodeFactory.register("chainner:rest:sd_img2img")
class Img2Img(AsyncNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Modify an image using an external Stable Diffusion service"
        self.inputs = [
            ImageInput(),
            TextInput("Prompt", default="an astronaut riding a horse"),
            TextInput("Negative Prompt", default=""),
            NumberInput(
                "Denoising Strength",
                minimum=0,
                default=0.75,
                maximum=1,
                controls_step=0.1,
                precision=4,
            ),
            NumberInput("Seed", minimum=0, default=42, maximum=4294967296),
            NumberInput("Steps", minimum=1, default=20, maximum=150),
            EnumInput(SamplerName, default_value=SamplerName.EULER),
            NumberInput(
                "CFG Scale",
                minimum=1,
                default=7,
                maximum=20,
                precision=4,
                controls_step=0.1,
            ),
            NumberInput("Width", minimum=64, default=512, maximum=2048),
            NumberInput("Height", minimum=64, default=512, maximum=2048),
            TextInput("Model Checkpoint Override", default=""),
        ]
        self.outputs = [
            LargeImageOutput(),
        ]

        self.category = RESTCategory
        self.name = "Image-to-Image"
        self.icon = "MdChangeCircle"
        self.sub = "Stable Diffusion"

    async def run_async(
        self,
        image: np.ndarray,
        prompt: str,
        negative_prompt: str,
        denoising_strength: float,
        seed: int,
        steps: int,
        sampler_name: SamplerName,
        cfg_scale: float,
        width: int,
        height: int,
        sd_model_checkpoint: str,
    ) -> np.ndarray:
        request_data = {
            "init_images": [encode_base64_image(image)],
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "denoising_strength": denoising_strength,
            "seed": seed,
            "steps": steps,
            "sampler_name": sampler_name.value,
            "cfg_scale": cfg_scale,
            "width": width,
            "height": height,
            "override_settings": {},
        }
        if sd_model_checkpoint != "":
            request_data["override_settings"][
                "sd_model_checkpoint"
            ] = sd_model_checkpoint
        response = await post_async(
            url=STABLE_DIFFUSION_IMG2IMG_URL, json_data=request_data
        )
        return decode_base64_image(response["images"][0])
