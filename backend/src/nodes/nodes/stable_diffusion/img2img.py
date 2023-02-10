from __future__ import annotations

from typing import Optional

import numpy as np

from nodes.impl.stable_diffusion.types import SDKitModel

from ...impl.stable_diffusion.stable_diffusion import (
    InternalSamplerName,
    nearest_valid_size,
)
from ...node_base import NodeBase, group
from ...node_cache import cached
from ...node_factory import NodeFactory
from ...properties.inputs import (
    EnumInput,
    ImageInput,
    NumberInput,
    SDKitModelInput,
    SliderInput,
    TextInput,
)
from ...properties.outputs import ImageOutput
from . import category as StableDiffusionCategory


@NodeFactory.register("chainner:stable_diffusion:img2img")
class Image2ImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [
            ImageInput(),
            SDKitModelInput("Model"),
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
            EnumInput(InternalSamplerName, default_value=InternalSamplerName.EULER),
            SliderInput(
                "CFG Scale",
                minimum=1,
                default=7,
                maximum=20,
                controls_step=0.1,
                precision=1,
            ),
            SliderInput(
                "Width",
                minimum=64,
                default=512,
                maximum=2048,
                slider_step=64,
                controls_step=64,
            ).with_id(9),
            SliderInput(
                "Height",
                minimum=64,
                default=512,
                maximum=2048,
                slider_step=64,
                controls_step=64,
            ).with_id(10),
        ]
        self.outputs = [
            ImageOutput(
                image_type="""def nearest_valid(n: number) = int & floor(n / 64) * 64;
                Image {
                    width: nearest_valid(Input9),
                    height: nearest_valid(Input10)
                }""",
                channels=3,
            ),
        ]

        self.category = StableDiffusionCategory
        self.name = "Generate"
        self.icon = "BsFillImageFill"
        self.sub = "Image to Image"

    @cached
    def run(
        self,
        init_image: np.ndarray,
        model: SDKitModel,
        prompt: str,
        negative_prompt: Optional[str],
        denoising_strength: float,
        seed: int,
        steps: int,
        sampler_name: InternalSamplerName,
        cfg_scale: float,
        width: int,
        height: int,
    ) -> np.ndarray:
        width, height = nearest_valid_size(
            width, height
        )  # This cooperates with the "image_type" of the ImageOutput
        image = model.sd.img2img(
            prompt=prompt,
            negative_prompt=negative_prompt,
            init_image=init_image,
            seed=seed,
            steps=steps,
            sampler_name=sampler_name,
            cfg_scale=cfg_scale,
            width=width,
            height=height,
            prompt_strength=denoising_strength,
        )
        return image
