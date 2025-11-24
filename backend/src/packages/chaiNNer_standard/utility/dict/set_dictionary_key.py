from __future__ import annotations

from nodes.properties.inputs import DictInput, TextInput
from nodes.properties.outputs import DictOutput

from .. import dict_group


@dict_group.register(
    schema_id="chainner:utility:set_dict_key",
    name="Set Dictionary Key",
    description="Sets or updates a key in a dictionary with a new value. If the key already exists, its value will be updated.",
    icon="MdEdit",
    inputs=[
        DictInput("Dictionary"),
        TextInput("Key", min_length=1),
        TextInput("Value", min_length=0, allow_empty_string=True),
    ],
    outputs=[
        DictOutput("Dictionary").suggest(),
    ],
)
def set_dictionary_key_node(
    dictionary: dict[str, str | int | float],
    key: str,
    value: str,
) -> dict[str, str | int | float]:
    # Create a copy to avoid modifying the original
    result = dictionary.copy()

    # Try to convert value to a number if possible
    try:
        # Try int first
        if "." not in value:
            result[key] = int(value)
        else:
            result[key] = float(value)
    except ValueError:
        # Keep as string if conversion fails
        result[key] = value

    return result
