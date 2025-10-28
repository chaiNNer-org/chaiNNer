from __future__ import annotations

from nodes.properties.outputs import TextOutput

from ...features import rtx_remix
from ...rtx_remix_api import RTX_REMIX_TEXTURES_PATH, get_api
from .. import remix_group


@remix_group.register(
    "chainner:external_rtx_remix:list_textures",
    name="List Textures",
    description="List all textures in the current RTX Remix scene",
    icon="BsFileImage",
    inputs=[],
    outputs=[
        TextOutput("Textures List", output_type="string"),
    ],
    features=rtx_remix,
)
def list_textures_node() -> str:
    """List all textures in the current RTX Remix scene."""
    response = get_api().get(RTX_REMIX_TEXTURES_PATH)
    # Convert the response to a formatted string
    import json

    return json.dumps(response, indent=2)
