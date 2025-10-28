from __future__ import annotations

import numpy as np

from nodes.properties.inputs import ImageInput, TextInput
from nodes.properties.outputs import TextOutput

from ...features import rtx_remix
from ...rtx_remix_api import RTX_REMIX_TEXTURES_PATH, get_api
from ...util import encode_base64_image
from .. import remix_group


@remix_group.register(
    "chainner:external_rtx_remix:replace_texture",
    name="Replace Texture",
    description="Replace a texture in the RTX Remix scene with a new image",
    icon="BsImage",
    inputs=[
        TextInput("Texture Name", placeholder="e.g., wall_texture_01"),
        ImageInput("New Texture Image"),
    ],
    outputs=[
        TextOutput("Result", output_type="string"),
    ],
    features=rtx_remix,
)
def replace_texture_node(
    texture_name: str,
    image: np.ndarray,
) -> str:
    """Replace a texture in the RTX Remix scene."""
    # Encode the image to base64
    image_base64 = encode_base64_image(image)

    # Send the request to replace the texture
    request_data = {
        "name": texture_name,
        "data": image_base64,
    }
    response = get_api().put(
        f"{RTX_REMIX_TEXTURES_PATH}/{texture_name}", json_data=request_data
    )

    # Return success message
    import json

    return json.dumps(response, indent=2)
