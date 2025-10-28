from __future__ import annotations

from nodes.properties.inputs import TextInput
from nodes.properties.outputs import TextOutput

from ...features import rtx_remix
from ...rtx_remix_api import RTX_REMIX_MATERIALS_PATH, get_api
from .. import remix_group


@remix_group.register(
    "chainner:external_rtx_remix:get_material_properties",
    name="Get Material Properties",
    description="Get properties of a specific material in the RTX Remix scene",
    icon="BsGear",
    inputs=[
        TextInput("Material Name", placeholder="e.g., material_01"),
    ],
    outputs=[
        TextOutput("Material Properties", output_type="string"),
    ],
    features=rtx_remix,
)
def get_material_properties_node(material_name: str) -> str:
    """Get properties of a specific material in the RTX Remix scene."""
    response = get_api().get(f"{RTX_REMIX_MATERIALS_PATH}/{material_name}")
    # Convert the response to a formatted string
    import json

    return json.dumps(response, indent=2)
