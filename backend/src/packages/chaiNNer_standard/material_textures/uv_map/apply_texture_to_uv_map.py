from __future__ import annotations

import math

import numpy as np

import navi
from nodes.properties.inputs import ImageInput
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from .. import normal_map_group


def clamp(x: int, min_: int, max_: int) -> int:
    return max(min_, min(x, max_))


@normal_map_group.register(
    schema_id="chainner:image:uv_map",
    name="Apply Texture to UV Map",
    description=[
        """Apply a texture to a UV map.""",
    ],
    icon="BsBoxArrowUpRight",  # TODO: change icon
    inputs=[
        ImageInput("Texture", channels=[3, 4]),
        ImageInput("UV Map", channels=[3, 4]),
    ],
    outputs=[
        ImageOutput(
            "Output",
            image_type=navi.Image(
                width="Input1.width",
                height="Input1.height",
            ),
            channels=3,
        ),
    ],
)
def apply_texture_to_uv_map_node(
    texture: np.ndarray,
    uv_map: np.ndarray,
) -> np.ndarray:
    # Step 1: Create a gradient matrix in the same shape as the input texture
    # Example image: https://user-images.githubusercontent.com/909728/50985266-4ab03a00-14da-11e9-9744-1a45f3a0655e.png
    # [[yellow, green]
    #  [red,    black]]

    # Set the size of the UV map texture

    # # Create an empty image (black background)
    # uv_map_ref = np.zeros((h, w, 3), dtype=np.uint8)

    # # Fill the image with UV coordinates
    # for y in range(h):
    #     for x in range(w):
    #         uv_map_ref[y, (w - x) - 1] = [
    #             0,
    #             255 - int(255 * (y / h)),
    #             255 - int(255 * (x / w)),
    #         ]

    # uv_map_denorm = np.clip((uv_map * 255).round(), 0, 255).astype(np.uint8)

    # uv_h, uv_w, uv_c = get_h_w_c(uv_map_denorm)
    # np.zeros((uv_h, uv_w, 3), dtype=np.float32)

    # # Flatten images for easy computation
    # flat_texture = texture.reshape((-1, c))
    # flat_uv = uv_map_denorm.reshape((-1, uv_c))
    # flat_ref = uv_map_ref.reshape((-1, uv_c))

    # # For each pixel, find the nearest color in the texture based on the UV coordinates
    # distances = np.linalg.norm(flat_uv[:, np.newaxis] - flat_ref, axis=2)
    # closest_palette_idx = np.argmin(distances, axis=1)
    # quantized_img_flat = flat_texture[closest_palette_idx]

    # # Reshape the quantized pixels to the original image shape
    # quantized_img = quantized_img_flat.reshape(uv_map_denorm.shape)

    h, w, c = get_h_w_c(texture)
    uv_h, uv_w, _ = get_h_w_c(uv_map)
    output = np.zeros((uv_h, uv_w, 3), dtype=np.float32)
    for x in range(uv_h):
        for y in range(uv_w):
            _, u, v = uv_map[x, y]
            tex_x = clamp(int(math.floor(v * h)), 0, h - 1)
            tex_y = clamp(int(math.floor(u * w)), 0, h - 1)
            output[x, y] = texture[tex_x, tex_y]

    return output
