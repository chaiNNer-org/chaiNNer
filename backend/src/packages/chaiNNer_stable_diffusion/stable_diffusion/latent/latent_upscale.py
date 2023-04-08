from __future__ import annotations

import torch

from nodes.impl.external_stable_diffusion import nearest_valid_size
from nodes.impl.stable_diffusion import CropMethod, LatentImage, UpscaleMethod
from nodes.properties.inputs import EnumInput, SliderInput
from nodes.properties.inputs.stable_diffusion_inputs import LatentImageInput
from nodes.properties.outputs.stable_diffusion_outputs import LatentImageOutput
from packages.chaiNNer_stable_diffusion.stable_diffusion import latent_group


@latent_group.register(
    "chainner:stable_diffusion:latent_upscale",
    name="Latent Upscale",
    description="",
    icon="BsFillImageFill",
    inputs=[
        LatentImageInput(),
        EnumInput(
            UpscaleMethod,
            default_value=UpscaleMethod.BILINEAR,
        ),
        EnumInput(
            CropMethod,
            default_value=CropMethod.DISABLED,
        ),
        SliderInput(
            "width",
            unit="px",
            minimum=64,
            maximum=4096,
            default=512,
            slider_step=64,
            controls_step=64,
        ),
        SliderInput(
            "height",
            unit="px",
            minimum=64,
            maximum=4096,
            default=512,
            slider_step=64,
            controls_step=64,
        ),
    ],
    outputs=[
        LatentImageOutput(
            image_type="""def nearest_valid(n: number) = int & floor(n / 64) * 64;
                LatentImage {
                    width: nearest_valid(Input3),
                    height: nearest_valid(Input4)
                }"""
        ),
    ],
)
@torch.no_grad()
def empty_latent_image(
    latent_image: LatentImage,
    upscale_method: UpscaleMethod,
    crop_method: CropMethod,
    width: int,
    height: int,
) -> LatentImage:
    width, height = nearest_valid_size(width, height, step=64)

    return latent_image.upscale(width, height, upscale_method, crop_method)
