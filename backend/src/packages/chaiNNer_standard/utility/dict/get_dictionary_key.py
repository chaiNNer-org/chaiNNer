from __future__ import annotations

from nodes.properties.inputs import DictInput, TextInput
from nodes.properties.outputs import TextOutput

from .. import dict_group


@dict_group.register(
    schema_id="chainner:utility:get_dict_key",
    name="Get Dictionary Key",
    description="Gets the value associated with a key in a dictionary. Returns an error if the key doesn't exist.",
    icon="MdSearch",
    inputs=[
        DictInput("Dictionary"),
        TextInput("Key", min_length=1),
    ],
    outputs=[
        TextOutput("Value").suggest(),
    ],
)
def get_dictionary_key_node(
    dictionary: dict[str, str | int | float],
    key: str,
) -> str:
    if key not in dictionary:
        raise KeyError(f"Key '{key}' not found in dictionary")

    # Convert the value to string for output
    value = dictionary[key]
    return str(value)
