from __future__ import annotations

import numpy as np

import navi
from nodes.properties.inputs import ImageInput, SliderInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import quantize_group


def add_xy(img: np.ndarray, scale: float) -> np.ndarray:
    h, w, _ = get_h_w_c(img)
    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    xx, yy = np.meshgrid(x, y)
    return np.dstack((img, xx * scale, yy * scale))


def quantize_image(image, palette):
    _, _, c = get_h_w_c(image)
    # Flatten image and palette for easy computation
    flat_img = image.reshape((-1, c))
    flat_palette = palette.reshape((-1, c))

    # For each pixel, find the nearest color in the palette
    distances = np.linalg.norm(flat_img[:, np.newaxis] - flat_palette, axis=2)
    closest_palette_idx = np.argmin(distances, axis=1)
    quantized_img_flat = flat_palette[closest_palette_idx]

    # Reshape the quantized pixels to the original image shape
    quantized_img = quantized_img_flat.reshape(image.shape)

    return quantized_img


@quantize_group.register(
    schema_id="chainner:image:quantize_local",
    name="Quantize (Local)",
    description="Quantize an image using another as a reference. Tries to preserve local color.",
    icon="BsPaletteFill",
    inputs=[
        ImageInput("Target Image", channels=[3, 4]),
        ImageInput(
            "Reference Image",
            channels=[3, 4],
            image_type=navi.Image(channels_as="Input0"),
        ),
        SliderInput("Kernel Radius", minimum=1, maximum=5, default=1),
        SliderInput(
            "Spacial Weight",
            minimum=0,
            maximum=100,
            precision=1,
            default=35,
            unit="%",
            controls_step=1,
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
            let valid = bool::and(
                Input0.width >= Input1.width,
                number::mod(Input0.width, Input1.width) == 0,
                Input0.height >= Input1.height,
                number::mod(Input0.height, Input1.height) == 0,
                Input0.channels == Input1.channels,
            );

            Image {
                width: max(Input0.width, Input1.width),
                height: max(Input0.height, Input1.height),
                channels: Input0.channels,
            } & if valid { any } else { never }""",
            assume_normalized=True,
        ).with_never_reason(
            "Target image must be larger than reference image in both dimensions, must have dimensions that are a multiple of each other, and must have the same number of channels."
        )
    ],
)
def quantize_local_node(
    img: np.ndarray,
    reference_img: np.ndarray,
    kernel_radius: int,
    spacial_scale: float,
) -> np.ndarray:
    i_h, i_w, i_c = get_h_w_c(img)
    r_h, r_w, r_c = get_h_w_c(reference_img)
    assert i_c == r_c, "Image and reference image must have the same number of channels"
    assert i_h >= r_h, "Image height must be larger than reference image height"
    assert i_h % r_h == 0, "Image height must be a multiple of reference image height"
    assert i_w >= r_w, "Image width must be larger than reference image width"
    assert i_w % r_w == 0, "Image width must be a multiple of reference image width"

    spacial_scale = spacial_scale / 100
    spacial_scale = spacial_scale * spacial_scale
    img = add_xy(img, r_w * spacial_scale)
    reference_img = add_xy(reference_img, r_w * spacial_scale)
    c = i_c + 2

    kernel_size = 2 * kernel_radius + 1
    scale = i_h // r_h

    padded_ref = np.pad(
        reference_img,
        ((kernel_radius, kernel_radius), (kernel_radius, kernel_radius), (0, 0)),
        mode="reflect",
    )

    result = np.zeros((i_h, i_w, i_c), dtype=np.float32)

    for h in range(r_h):
        for w in range(r_w):
            kernel = padded_ref[h : h + kernel_size, w : w + kernel_size]
            colors = np.unique(kernel.reshape(-1, c), axis=0)
            img_section = img[h * scale : (h + 1) * scale, w * scale : (w + 1) * scale]
            quantized_section = quantize_image(img_section, colors)
            quantized_section = quantized_section[:, :, :i_c]
            result[
                h * scale : (h + 1) * scale,
                w * scale : (w + 1) * scale,
            ] = quantized_section

    return result
