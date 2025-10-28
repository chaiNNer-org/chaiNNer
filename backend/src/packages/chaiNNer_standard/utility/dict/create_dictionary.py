from __future__ import annotations

from nodes.properties.inputs import TextInput
from nodes.properties.outputs import DictOutput

from .. import dict_group


@dict_group.register(
    schema_id="chainner:utility:create_dict",
    name="Create Dictionary",
    description="Creates a new dictionary from key-value pairs. You can add up to 10 key-value pairs.",
    icon="MdDataObject",
    inputs=[
        TextInput("Key 1", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Value 1", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Key 2", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Value 2", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Key 3", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Value 3", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Key 4", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Value 4", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Key 5", min_length=0, allow_empty_string=True).make_optional(),
        TextInput("Value 5", min_length=0, allow_empty_string=True).make_optional(),
    ],
    outputs=[
        DictOutput("Dictionary").suggest(),
    ],
)
def create_dictionary_node(
    key1: str | None,
    value1: str | None,
    key2: str | None,
    value2: str | None,
    key3: str | None,
    value3: str | None,
    key4: str | None,
    value4: str | None,
    key5: str | None,
    value5: str | None,
) -> dict[str, str | int | float]:
    result: dict[str, str | int | float] = {}

    # Helper function to add key-value pair if both are provided
    def add_pair(key: str | None, value: str | None):
        if key is not None and value is not None:
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

    add_pair(key1, value1)
    add_pair(key2, value2)
    add_pair(key3, value3)
    add_pair(key4, value4)
    add_pair(key5, value5)

    return result
