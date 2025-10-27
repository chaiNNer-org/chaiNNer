from __future__ import annotations

from nodes.properties.inputs import DictInput, TextInput
from nodes.properties.outputs import DictOutput

from .. import dict_group


@dict_group.register(
    schema_id="chainner:utility:remove_dict_keys",
    name="Remove Dictionary Keys",
    description="Removes specified keys from a dictionary. Keys that don't exist in the dictionary will be ignored.",
    icon="MdDelete",
    inputs=[
        DictInput("Dictionary"),
        TextInput("Key 1", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Key 2", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Key 3", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Key 4", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Key 5", min_length=0, allow_empty_string=True).make_optional(),
    ],
    outputs=[
        DictOutput("Dictionary").suggest(),
    ],
)
def remove_dict_keys_node(
    dictionary: dict[str, str | int | float],
    key1: str | None,
    key2: str | None,
    key3: str | None,
    key4: str | None,
    key5: str | None,
) -> dict[str, str | int | float]:
    # Create a copy to avoid modifying the original
    result = dictionary.copy()

    # Remove keys if they exist
    keys_to_remove = [key1, key2, key3, key4, key5]
    for key in keys_to_remove:
        if key is not None and key in result:
            del result[key]

    return result
