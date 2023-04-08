from __future__ import annotations

from typing import Optional

import cv2
import numpy as np
import torch

from nodes.group import group
from nodes.impl.external_stable_diffusion import nearest_valid_size
from nodes.impl.stable_diffusion.types import (
    CLIPModel,
    LatentImage,
    Sampler,
    Scheduler,
    StableDiffusionModel,
    VAEModel,
)
from nodes.properties import expression
from nodes.properties.inputs import EnumInput, NumberInput, SliderInput, TextAreaInput
from nodes.properties.inputs.stable_diffusion_inputs import (
    CLIPModelInput,
    StableDiffusionModelInput,
    VAEModelInput,
)
from nodes.properties.outputs import ImageOutput

from .. import abstract_group


@abstract_group.register(
    "chainner:stable_diffusion:txt2img",
    name="Text to Image",
    description="Generate an image",
    icon="BsFillImageFill",
    inputs=[
        StableDiffusionModelInput(),
        CLIPModelInput(input_type=expression.CLIPModel(arch_as="Input0")),
        VAEModelInput(),
        SliderInput(
            "Width",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=64,
            controls_step=64,
        ),
        SliderInput(
            "Height",
            minimum=64,
            default=512,
            maximum=2048,
            slider_step=64,
            controls_step=64,
        ),
        TextAreaInput("Prompt").make_optional(),
        TextAreaInput("Negative Prompt").make_optional(),
        group("seed")(NumberInput("Seed", minimum=0, default=42, maximum=4294967296)),
        SliderInput("Steps", minimum=1, default=20, maximum=150),
        EnumInput(
            Sampler,
            default_value=Sampler.SAMPLE_EULER,
        ),
        EnumInput(
            Scheduler,
            default_value=Scheduler.NORMAL,
        ),
        SliderInput(
            "CFG Scale",
            minimum=1,
            default=7,
            maximum=20,
            controls_step=0.1,
            precision=1,
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""def nearest_valid(n: number) = int & floor(n / 64) * 64;
                    Image {
                        width: nearest_valid(Input3),
                        height: nearest_valid(Input4)
                    }""",
            channels=3,
        ),
    ],
)
@torch.no_grad()
def text_to_image(
    model: StableDiffusionModel,
    clip: CLIPModel,
    vae: VAEModel,
    width: int,
    height: int,
    positive: Optional[str],
    negative: Optional[str],
    seed: int,
    steps: int,
    sampler: Sampler,
    scheduler: Scheduler,
    cfg_scale: float,
) -> np.ndarray:
    width, height = nearest_valid_size(
        width, height, step=64
    )  # This cooperates with the "image_type" of the ImageOutput

    positive = positive or ""
    negative = negative or ""

    try:
        clip.cuda()
        pos = clip.encode(positive)
        neg = clip.encode(negative)
    finally:
        clip.cpu()

    try:
        model.cuda()
        latent = LatentImage.empty(width, height, device="cuda")
        img = model.sample(
            positive=pos,
            negative=neg,
            latent_image=latent,
            seed=seed,
            steps=steps,
            cfg_scale=cfg_scale,
            sampler=sampler,
            scheduler=scheduler,
            denoise_strength=1.0,
        )
        del latent, pos, neg
    finally:
        model.cpu()

    try:
        vae.cuda()
        out = vae.decode(img)
        del img
    finally:
        vae.cpu()

    return cv2.cvtColor(out.to_array(), cv2.COLOR_RGB2BGR)
