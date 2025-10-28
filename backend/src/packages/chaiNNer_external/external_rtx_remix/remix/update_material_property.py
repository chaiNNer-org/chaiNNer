from __future__ import annotations

from nodes.properties.inputs import NumberInput, TextInput
from nodes.properties.outputs import TextOutput

from ...features import rtx_remix
from ...rtx_remix_api import RTX_REMIX_MATERIALS_PATH, get_api
from .. import remix_group


@remix_group.register(
    "chainner:external_rtx_remix:update_material_property",
    name="Update Material Property",
    description="Update a property of a material in the RTX Remix scene",
    icon="BsWrench",
    inputs=[
        TextInput("Material Name", placeholder="e.g., material_01"),
        TextInput("Property Name", placeholder="e.g., roughness"),
        NumberInput("Property Value", default=0.5, min=0, max=1, step=0.01),
    ],
    outputs=[
        TextOutput("Result", output_type="string"),
    ],
    features=rtx_remix,
)
def update_material_property_node(
    material_name: str,
    property_name: str,
    property_value: float,
) -> str:
    """Update a property of a material in the RTX Remix scene."""
    request_data = {
        property_name: property_value,
    }
    response = get_api().put(
        f"{RTX_REMIX_MATERIALS_PATH}/{material_name}", json_data=request_data
    )
    # Return success message
    import json

    return json.dumps(response, indent=2)
