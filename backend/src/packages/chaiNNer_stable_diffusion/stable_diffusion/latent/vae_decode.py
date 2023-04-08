from __future__ import annotations

import cv2
import numpy as np
import torch

from nodes.impl.stable_diffusion.types import LatentImage, VAEModel
from nodes.properties.inputs.stable_diffusion_inputs import (
    LatentImageInput,
    VAEModelInput,
)
from nodes.properties.outputs import ImageOutput
from packages.chaiNNer_stable_diffusion.stable_diffusion import latent_group


@latent_group.register(
    "chainner:stable_diffusion:vae_decode",
    name="VAE Decode",
    description="",
    icon="BsFillImageFill",
    inputs=[
        LatentImageInput(),
        VAEModelInput(),
    ],
    outputs=[
        ImageOutput(
            image_type="""Image{ width: Input0.width, height: Input0.height }""",
            channels=3,
        ),
    ],
)
@torch.no_grad()
def vae_decode(latent_image: LatentImage, vae: VAEModel) -> np.ndarray:
    try:
        vae.cuda()
        latent_image.cuda()
        img = vae.decode(latent_image)
    finally:
        vae.cpu()
        latent_image.cpu()

    return cv2.cvtColor(img.to_array(), cv2.COLOR_RGB2BGR)
