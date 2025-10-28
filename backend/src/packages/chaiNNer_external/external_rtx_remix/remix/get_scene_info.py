from __future__ import annotations

from nodes.properties.outputs import TextOutput

from ...features import rtx_remix
from ...rtx_remix_api import RTX_REMIX_SCENE_PATH, get_api
from .. import remix_group


@remix_group.register(
    "chainner:external_rtx_remix:get_scene_info",
    name="Get Scene Info",
    description="Get information about the current RTX Remix scene",
    icon="BsInfoCircle",
    inputs=[],
    outputs=[
        TextOutput("Scene Info", output_type="string"),
    ],
    features=rtx_remix,
)
def get_scene_info_node() -> str:
    """Get information about the current RTX Remix scene."""
    response = get_api().get(RTX_REMIX_SCENE_PATH)
    # Convert the response to a formatted string
    import json

    return json.dumps(response, indent=2)
