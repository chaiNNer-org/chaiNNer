from __future__ import annotations

from nodes.properties.inputs import DictInput
from nodes.properties.outputs import DictOutput

from .. import dict_group


@dict_group.register(
    schema_id="chainner:utility:merge_dicts",
    name="Merge Dictionaries",
    description="Merges two dictionaries together. If the same key exists in both dictionaries, the value from Dictionary 2 will overwrite the value from Dictionary 1.",
    icon="MdMerge",
    inputs=[
        DictInput("Dictionary 1"),
        DictInput("Dictionary 2"),
    ],
    outputs=[
        DictOutput("Merged Dictionary").suggest(),
    ],
)
def merge_dicts_node(
    dict1: dict[str, str | int | float],
    dict2: dict[str, str | int | float],
) -> dict[str, str | int | float]:
    # Create a new dictionary with dict1's contents
    result = dict1.copy()
    # Update with dict2's contents (overwrites duplicate keys)
    result.update(dict2)
    return result
