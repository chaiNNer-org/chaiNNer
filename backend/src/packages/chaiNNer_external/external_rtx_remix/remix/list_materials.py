from __future__ import annotations

from nodes.properties.outputs import TextOutput

from ...features import rtx_remix
from ...rtx_remix_api import RTX_REMIX_MATERIALS_PATH, get_api
from .. import remix_group


@remix_group.register(
    "chainner:external_rtx_remix:list_materials",
    name="List Materials",
    description="List all materials in the current RTX Remix scene",
    icon="BsGrid3x3",
    inputs=[],
    outputs=[
        TextOutput("Materials List", output_type="string"),
    ],
    features=rtx_remix,
)
def list_materials_node() -> str:
    """List all materials in the current RTX Remix scene."""
    response = get_api().get(RTX_REMIX_MATERIALS_PATH)
    # Convert the response to a formatted string
    import json

    return json.dumps(response, indent=2)
