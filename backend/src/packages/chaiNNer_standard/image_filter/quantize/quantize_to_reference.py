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


def quantize_image(image: np.ndarray, palette: np.ndarray):
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
    schema_id="chainner:image:quantize_to_referece",
    name="Quantize to Reference",
    description=[
        "Quantize an image using another as a reference. Tries to preserve local color.",
        "The main purpose of this node is to improve the upscaled images of pixel art. Upscaling models are typically not good at preserving color perfectly, and a smoothly upscaled image can look very different from the original.",
        "Ideally, we would like to use the color palette of the original image to preserve the pixel art feel. While `chainner:image:palette_dither` can be used to this end, it will often choose colors from all over the original image. This is because upscaling models aren't very good at preserving color, and so the closest color in the palette may be very different from the color of that pixel in the original image.",
        "This node addresses this issue using a **local color palette**. When quantizing a pixel in the upscaled image, we pick the nearest color from a small region around this pixel in the original image. This ensures that the quantized image will have the same colors in the roughly same positions as the original image.",
        "#### Dithering",
        "This node does not perform any dithering. If you want to dither the quantized image, use `chainner:image:palette_dither` on the target image before passing it into this node.",
    ],
    icon="BsPaletteFill",
    inputs=[
        ImageInput("Target Image", channels=[3, 4]),
        ImageInput(
            "Reference Image",
            channels=[3, 4],
            image_type=navi.Image(channels_as="Input0"),
        ),
        SliderInput("Kernel Radius", minimum=1, maximum=5, default=1).with_docs(
            "Determines the size of the region around each pixel in the reference image that is used to determine the local color palette.",
            "The size of the region will be `2 * radius + 1`. So a radius of 1 will be a 3x3 region, a radius of 2 will be a 5x5 region, etc.",
        ),
        SliderInput(
            "Spatial Weight",
            minimum=0,
            maximum=100,
            precision=1,
            default=0,
            unit="%",
            controls_step=1,
        ).with_docs(
            "When picking a color from the local color palette, this node not only considers the color but also the position of the pixel in the reference image. This value determines how much weight is given to the positions of the pixels in the local color palette. 0% means that the position is ignored, and 100% means that the position is the primary determining factor.",
            """Which value is best depends on the image. E.g. 0% is best when the reference image contains dithering. Values >70% are typically not very useful.""",
        ),
    ],
    outputs=[
        ImageOutput(
            image_type="""
            if Input0.channels != Input1.channels {
                error("The target image and reference image must have the same number of channels.")
            } else if bool::or(Input0.width < Input1.width, Input0.height < Input1.height) {
                error("The target image must be larger than the reference image.")
            } else if bool::or(number::mod(Input0.width, Input1.width) != 0, number::mod(Input0.height, Input1.height) != 0) {
                error("The size of the target image must be an integer multiple of the size of the reference image (e.g. 2x, 3x, 4x, 8x).")
            } else {
                Image {
                    width: max(Input0.width, Input1.width),
                    height: max(Input0.height, Input1.height),
                    channels: Input0.channels,
                }
            }
            """,
            assume_normalized=True,
        )
    ],
)
def quantize_to_reference_node(
    img: np.ndarray,
    reference_img: np.ndarray,
    kernel_radius: int,
    spatial_scale: float,
) -> np.ndarray:
    i_h, i_w, i_c = get_h_w_c(img)
    r_h, r_w, r_c = get_h_w_c(reference_img)
    assert i_c == r_c, "Image and reference image must have the same number of channels"
    assert i_h >= r_h, "Image height must be larger than reference image height"
    assert i_h % r_h == 0, "Image height must be a multiple of reference image height"
    assert i_w >= r_w, "Image width must be larger than reference image width"
    assert i_w % r_w == 0, "Image width must be a multiple of reference image width"

    spatial_scale = spatial_scale / 100
    spatial_scale = spatial_scale * spatial_scale
    img = add_xy(img, r_w * spatial_scale)
    reference_img = add_xy(reference_img, r_w * spatial_scale)
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
