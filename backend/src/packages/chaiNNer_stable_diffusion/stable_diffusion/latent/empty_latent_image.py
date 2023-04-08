from __future__ import annotations

import torch

from nodes.impl.external_stable_diffusion import nearest_valid_size
from nodes.impl.stable_diffusion import LatentImage
from nodes.properties.inputs import SliderInput
from nodes.properties.outputs.stable_diffusion_outputs import LatentImageOutput
from packages.chaiNNer_stable_diffusion.stable_diffusion import latent_group


@latent_group.register(
    "chainner:stable_diffusion:empty_latent_image",
    name="Empty Latent Image",
    description="",
    icon="BsFillImageFill",
    inputs=[
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
    ],
    outputs=[
        LatentImageOutput(
            image_type="""def nearest_valid(n: number) = int & floor(n / 64) * 64;
            LatentImage {
                width: nearest_valid(Input0),
                height: nearest_valid(Input1)
            }""",
        ),
    ],
)
@torch.no_grad()
def empty_latent_image(width: int, height: int) -> LatentImage:
    width, height = nearest_valid_size(width, height, step=64)

    return LatentImage.empty(width, height)
