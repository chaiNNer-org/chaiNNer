from __future__ import annotations

from typing import Optional

import cv2
import numpy as np
import torch

from nodes.group import group
from nodes.impl.pil_utils import InterpolationMethod, resize
from nodes.impl.stable_diffusion import (
    CLIPModel,
    RGBImage,
    Sampler,
    Scheduler,
    StableDiffusionModel,
    VAEModel,
)
from nodes.properties import expression
from nodes.properties.inputs import (
    EnumInput,
    ImageInput,
    NumberInput,
    SliderInput,
    TextAreaInput,
)
from nodes.properties.inputs.stable_diffusion_inputs import (
    CLIPModelInput,
    StableDiffusionModelInput,
    VAEModelInput,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c, nearest_valid_size

from .. import abstract_group


@abstract_group.register(
    "chainner:stable_diffusion:img2img",
    name="Image to Image",
    description="",
    icon="BsFillImageFill",
    inputs=[
        ImageInput(channels=3),
        StableDiffusionModelInput(),
        CLIPModelInput(input_type=expression.CLIPModel(arch_as="Input1")),
        VAEModelInput(),
        TextAreaInput("Prompt").make_optional(),
        TextAreaInput("Negative Prompt").make_optional(),
        SliderInput(
            "Denoising Strength",
            minimum=0,
            default=0.75,
            maximum=1,
            slider_step=0.01,
            controls_step=0.1,
            precision=2,
        ),
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
                    width: nearest_valid(Input0.width),
                    height: nearest_valid(Input0.height)
                }""",
            channels=3,
        ),
    ],
)
@torch.no_grad()
def text_to_image(
    input_image: np.ndarray,
    model: StableDiffusionModel,
    clip: CLIPModel,
    vae: VAEModel,
    positive: Optional[str],
    negative: Optional[str],
    denoising_strength: float,
    seed: int,
    steps: int,
    sampler: Sampler,
    scheduler: Scheduler,
    cfg_scale: float,
) -> np.ndarray:
    height, width, _ = get_h_w_c(input_image)

    width1, height1 = nearest_valid_size(
        width, height, step=64
    )  # This cooperates with the "image_type" of the ImageOutput

    if width1 != width or height1 != height:
        input_image = resize(input_image, (width1, height1), InterpolationMethod.AUTO)

    positive = positive or ""
    negative = negative or ""

    try:
        vae.cuda()
        latent = vae.encode(RGBImage.from_array(input_image, device="cuda"))
    finally:
        vae.cpu()

    try:
        clip.cuda()
        pos = clip.encode(positive)
        neg = clip.encode(negative)
    finally:
        clip.cpu()

    try:
        model.cuda()
        img = model.sample(
            positive=pos,
            negative=neg,
            latent_image=latent,
            seed=seed,
            steps=steps,
            cfg_scale=cfg_scale,
            sampler=sampler,
            scheduler=scheduler,
            denoise_strength=denoising_strength,
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
