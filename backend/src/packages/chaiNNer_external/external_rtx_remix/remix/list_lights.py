from __future__ import annotations

from nodes.properties.outputs import TextOutput

from ...features import rtx_remix
from ...rtx_remix_api import RTX_REMIX_LIGHTS_PATH, get_api
from .. import remix_group


@remix_group.register(
    "chainner:external_rtx_remix:list_lights",
    name="List Lights",
    description="List all lights in the current RTX Remix scene",
    icon="BsLightbulb",
    inputs=[],
    outputs=[
        TextOutput("Lights List", output_type="string"),
    ],
    features=rtx_remix,
)
def list_lights_node() -> str:
    """List all lights in the current RTX Remix scene."""
    response = get_api().get(RTX_REMIX_LIGHTS_PATH)
    # Convert the response to a formatted string
    import json

    return json.dumps(response, indent=2)
