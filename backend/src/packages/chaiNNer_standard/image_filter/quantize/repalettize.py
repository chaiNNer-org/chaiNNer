from __future__ import annotations

import numpy as np

import navi
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import quantize_group


def quantize_image(image, palette):
    # Flatten image and palette for easy computation
    flat_img = image.reshape((-1, 3))
    flat_palette = palette.reshape((-1, 3))

    # For each pixel, find the nearest color in the palette
    distances = np.linalg.norm(flat_img[:, np.newaxis] - flat_palette, axis=2)
    closest_palette_idx = np.argmin(distances, axis=1)
    quantized_img_flat = flat_palette[closest_palette_idx]

    # Reshape the quantized pixels to the original image shape
    quantized_img = quantized_img_flat.reshape(image.shape)

    return quantized_img


@quantize_group.register(
    schema_id="chainner:image:repalettize",
    name="Repalettize",
    description="Quantize an image using another as a reference. Tries to preserve local color.",
    icon="BsPaletteFill",
    inputs=[
        ImageInput("Image", channels=[3, 4]),
        ImageInput(
            "Reference Image",
            channels=[3, 4],
            image_type=navi.Image(channels_as="Input0"),
        ),
    ],
    outputs=[
        ImageOutput(
            assume_normalized=True,
        ).with_never_reason("All input channels must have the same dimensions.")
    ],
)
def repalettize_node(
    img: np.ndarray,
    reference_img: np.ndarray,
) -> np.ndarray:
    i_h, i_w, i_c = get_h_w_c(img)
    r_h, r_w, r_c = get_h_w_c(reference_img)
    assert i_c == r_c, "Image and reference image must have the same number of channels"
    assert i_h % r_h == 0, "Image height must be a multiple of reference image height"
    assert i_w % r_w == 0, "Image width must be a multiple of reference image width"

    scale = i_h // r_h

    padded_ref = np.pad(reference_img, ((1, 1), (1, 1), (0, 0)), mode="reflect")

    result = np.zeros((i_h, i_w, i_c), dtype=np.float32)

    for h in range(r_h):
        for w in range(r_w):
            kernel = padded_ref[h : h + 3, w : w + 3]
            colors = np.unique(kernel.reshape(-1, 3), axis=0)
            img_section = img[h * scale : (h + 1) * scale, w * scale : (w + 1) * scale]
            quantized_section = quantize_image(img_section, colors)
            result[
                h * scale : (h + 1) * scale,
                w * scale : (w + 1) * scale,
            ] = quantized_section

    return result
