# Wavelet color fix from "sd-webui-stablesr" https://github.com/pkuliyi2015/sd-webui-stablesr/blob/master/srmodule/colorfix.py

# Node by tepete/pifroggi ('Enhance Everything!' Discord Server)

import numpy as np
import torch
import torch.nn.functional as F  # noqa: N812

from api import NodeContext
from nodes.impl.pytorch.utils import np2tensor, safe_cuda_cache_empty, tensor2np
from nodes.impl.resize import ResizeFilter, resize
from nodes.properties.inputs import ImageInput, NumberInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import get_settings
from .. import processing_group


def wavelet_blur(image: torch.Tensor, radius: int) -> torch.Tensor:
    kernel_vals = [
        [0.0625, 0.125, 0.0625],
        [0.125, 0.25, 0.125],
        [0.0625, 0.125, 0.0625],
    ]
    kernel = torch.tensor(kernel_vals, dtype=image.dtype, device=image.device)
    kernel = kernel[None, None].repeat(3, 1, 1, 1)
    image = F.pad(image, (radius, radius, radius, radius), mode="replicate")
    output = F.conv2d(image, kernel, groups=3, dilation=radius)
    return output


def wavelet_decomposition(image: torch.Tensor, levels: int = 5):
    high_freq = torch.zeros_like(image)
    low_freq = image
    for i in range(levels):
        low_freq = wavelet_blur(image, radius=2**i)
        high_freq += image - low_freq
        image = low_freq
    return high_freq, low_freq


def wavelet_reconstruction(
    content_feat: torch.Tensor, style_feat: torch.Tensor, levels: int
) -> torch.Tensor:
    content_high_freq, _ = wavelet_decomposition(content_feat, levels=levels)
    _, style_low_freq = wavelet_decomposition(style_feat, levels=levels)
    return content_high_freq + style_low_freq


@processing_group.register(
    schema_id="chainner:pytorch:wavelet_color_fix",
    name="Wavelet Color Fix",
    description=[
        "Correct for upscaling model color shift by first separating the image into wavelets of different frequencies, then matching the average color of the Input Image to that of a Reference Image. In general produces better results than the Average Color Fix at the cost of more computation."
    ],
    icon="MdAutoFixHigh",
    inputs=[
        ImageInput("Image", channels=3),
        ImageInput("Reference Image", channels=3),
        NumberInput("Number of Wavelets", min=1, max=10, default=5, unit="#").with_docs(
            "Around 5 seems to work best in most cases.",
            "**Higher** means a more global color match. Wider bloom/bleed and less local color precision.",
            "**Lower** means a more local color match. Smaller bloom/bleed and more artifacts. Too low and the reference image will become visible.",
            hint=True,
        ),
    ],
    outputs=[ImageOutput(shape_as=0).with_docs("Returns the color-fixed image.")],
    node_context=True,
)
def wavelet_color_fix_node(
    context: NodeContext, target_img: np.ndarray, source_img: np.ndarray, levels: int
) -> np.ndarray:
    target_h, target_w, _ = get_h_w_c(target_img)

    # resize source image to match target image
    source_img_resized = resize(
        source_img, (target_w, target_h), filter=ResizeFilter.BOX
    )

    exec_options = get_settings(context)
    context.add_cleanup(
        safe_cuda_cache_empty,
        after="node" if exec_options.force_cache_wipe else "chain",
    )
    device = exec_options.device

    # convert to tensors
    target_tensor = np2tensor(target_img, change_range=True).to(device)
    source_tensor_resized = np2tensor(source_img_resized, change_range=True).to(device)

    # wavelet color fix
    result_tensor = wavelet_reconstruction(
        target_tensor, source_tensor_resized, levels=levels
    )

    # convert back to numpy array
    result_img = tensor2np(
        result_tensor.detach().cpu(), change_range=False, imtype=np.float32
    )

    return result_img
