from __future__ import annotations

from pathlib import Path

from nodes.properties.inputs import DirectoryInput, NumberInput
from nodes.properties.outputs import DirectoryOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:back_directory",
    name="Back Directory",
    description="Traverse up/back from a directory the specified number of times.",
    icon="BsFolder",
    inputs=[
        DirectoryInput(
            "Directory", must_exist=False, label_style="hidden", has_handle=True
        ),
        NumberInput("Amount back", has_handle=True, minimum=1, precision=0),
    ],
    outputs=[
        DirectoryOutput("Directory"),
    ],
)
def back_directory_node(directory: Path, amt: int) -> Path:
    result = directory
    for _ in range(amt):
        result = result.parent
    return result
