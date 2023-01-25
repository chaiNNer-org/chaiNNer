from __future__ import annotations

import numpy as np

from . import category as ExternalStableDiffusionCategory
from ...impl.external_stable_diffusion import (
    decode_base64_image,
    SamplerName,
    STABLE_DIFFUSION_TEXT2IMG_URL,
    post,
)
from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import (
    TextInput,
    NumberInput,
    SliderInput,
    EnumInput,
)
from ...properties.outputs import LargeImageOutput
from typing import Optional


@NodeFactory.register("chainner:external_stable_diffusion:txt2img")
class Txt2Img(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Generate an image using Automatic1111"
        self.inputs = [
            TextInput("Prompt", default="an astronaut riding a horse"),
            TextInput("Negative Prompt").make_optional(),
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
            SliderInput("Width", minimum=64, default=512, maximum=2048),
            SliderInput("Height", minimum=64, default=512, maximum=2048),
            TextInput("Model Checkpoint Override").make_optional(),
        ]
        self.outputs = [
            LargeImageOutput(),
        ]

        self.category = ExternalStableDiffusionCategory
        self.name = "Text-to-Image"
        self.icon = "BsFillImageFill"
        self.sub = "Automatic1111"

    def run(
        self,
        prompt: str,
        negative_prompt: Optional[str],
        seed: int,
        steps: int,
        sampler_name: SamplerName,
        cfg_scale: float,
        width: int,
        height: int,
        sd_model_checkpoint: Optional[str],
    ) -> np.ndarray:
        request_data = {
            "prompt": prompt,
            "negative_prompt": negative_prompt or "",
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
        response = post(url=STABLE_DIFFUSION_TEXT2IMG_URL, json_data=request_data)
        return decode_base64_image(response["images"][0])
