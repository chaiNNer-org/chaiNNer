from __future__ import annotations

import numpy as np

from . import category as ExternalStableDiffusionCategory
from ...impl.external_stable_diffusion import (
    decode_base64_image,
    SamplerName,
    STABLE_DIFFUSION_IMG2IMG_URL,
    post,
    encode_base64_image,
)
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import (
    TextInput,
    NumberInput,
    SliderInput,
    EnumInput,
    ImageInput,
)
from ...properties.outputs import ImageOutput
from typing import Optional


@NodeFactory.register("chainner:external_stable_diffusion:img2img")
class Img2Img(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Modify an image using Automatic1111"
        self.inputs = [
            ImageInput(),
            TextInput("Prompt", default="an astronaut riding a horse"),
            TextInput("Negative Prompt").make_optional(),
            SliderInput(
                "Denoising Strength",
                minimum=0,
                default=0.75,
                maximum=1,
                slider_step=0.01,
                controls_step=0.1,
                precision=2,
            ),
            group("seed")(
                NumberInput("Seed", minimum=0, default=42, maximum=4294967296)
            ),
            SliderInput("Steps", minimum=1, default=20, maximum=150),
            EnumInput(SamplerName, default_value=SamplerName.EULER),
            SliderInput(
                "CFG Scale",
                minimum=1,
                default=7,
                maximum=20,
                controls_step=0.1,
                precision=1,
            ),
            SliderInput("Width", minimum=64, default=512, maximum=2048).with_id(8),
            SliderInput("Height", minimum=64, default=512, maximum=2048).with_id(9),
            TextInput("Model Checkpoint Override").make_optional(),
        ]
        self.outputs = [
            ImageOutput(
                image_type="Image {width: Input8, height: Input9, channels: 3}"
            ),
        ]

        self.category = ExternalStableDiffusionCategory
        self.name = "Image to Image"
        self.icon = "MdChangeCircle"
        self.sub = "Automatic1111"

    def run(
        self,
        image: np.ndarray,
        prompt: str,
        negative_prompt: Optional[str],
        denoising_strength: float,
        seed: int,
        steps: int,
        sampler_name: SamplerName,
        cfg_scale: float,
        width: int,
        height: int,
        sd_model_checkpoint: Optional[str],
    ) -> np.ndarray:
        request_data = {
            "init_images": [encode_base64_image(image)],
            "prompt": prompt,
            "negative_prompt": negative_prompt or "",
            "denoising_strength": denoising_strength,
            "seed": seed,
            "steps": steps,
            "sampler_name": sampler_name.value,
            "cfg_scale": cfg_scale,
            "width": width,
            "height": height,
            "override_settings": {},
        }
        if sd_model_checkpoint:
            request_data["override_settings"][
                "sd_model_checkpoint"
            ] = sd_model_checkpoint
        response = post(url=STABLE_DIFFUSION_IMG2IMG_URL, json_data=request_data)
        return decode_base64_image(response["images"][0])
