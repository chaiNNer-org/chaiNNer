from __future__ import annotations

from pathlib import Path

from nodes.properties.inputs import DirectoryInput, NumberInput
from nodes.properties.outputs import DirectoryOutput

from .. import directory_group


@directory_group.register(
    schema_id="chainner:utility:back_directory",
    name="Directory Go Up",
    description="Traverse up from a directory the specified number of times.",
    icon="BsFolder",
    inputs=[
        DirectoryInput(must_exist=False, label_style="hidden"),
        NumberInput("Times", minimum=0, default=1, label_style="inline").with_docs(
            "How many times to go up.",
            "- 0 will return the given directory as is.",
            "- 1 will return the parent directory.",
            "- 2 will return the grandparent directory.",
            "- etc.",
            hint=True,
        ),
    ],
    outputs=[
        DirectoryOutput(
            output_type="Directory { path: getParentDirectory(Input0.path, Input1) }",
        ),
    ],
)
def directory_go_up_node(directory: Path, amt: int) -> Path:
    result = directory
    for _ in range(amt):
        result = result.parent
    return result
