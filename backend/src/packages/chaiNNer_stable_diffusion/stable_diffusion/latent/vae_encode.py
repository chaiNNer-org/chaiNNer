from __future__ import annotations

import numpy as np

from nodes.impl.pil_utils import InterpolationMethod, resize
from nodes.impl.stable_diffusion import LatentImage, RGBImage, VAEModel
from nodes.properties.inputs import ImageInput
from nodes.properties.inputs.stable_diffusion_inputs import VAEModelInput
from nodes.properties.outputs.stable_diffusion_outputs import LatentImageOutput
from nodes.utils.utils import get_h_w_c, nearest_valid_size
from packages.chaiNNer_stable_diffusion.stable_diffusion import latent_group


@latent_group.register(
    "chainner:stable_diffusion:vae_encode",
    name="VAE Encode",
    description="",
    icon="MdAutoAwesome",
    inputs=[
        ImageInput(channels=3),
        VAEModelInput(),
    ],
    outputs=[
        LatentImageOutput(
            image_type="""def nearest_valid(n: number) = int & floor(n / 64) * 64;
                LatentImage {
                    width: nearest_valid(Input0.width),
                    height: nearest_valid(Input0.height)
                }""",
        ),
    ],
)
def vae_encode(image: np.ndarray, vae: VAEModel) -> LatentImage:
    height, width, _ = get_h_w_c(image)

    width1, height1 = nearest_valid_size(
        width, height, step=64
    )  # This cooperates with the "image_type" of the ImageOutput

    if width1 != width or height1 != height:
        image = resize(image, (width1, height1), InterpolationMethod.AUTO)

    try:
        vae.cuda()
        img = RGBImage.from_array(image, device="cuda")
        latent = vae.encode(img)
    finally:
        vae.cpu()

    return latent.cpu()
