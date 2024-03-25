from __future__ import annotations

from pathlib import Path

from nodes.properties.inputs import DirectoryInput
from nodes.properties.outputs import DirectoryOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:directory",
    name="Directory",
    description="Outputs the given directory.",
    icon="BsFolder",
    inputs=[
        DirectoryInput(must_exist=False, label_style="hidden").make_fused(),
    ],
    outputs=[
        DirectoryOutput(output_type="Input0").suggest(),
    ],
)
def directory_node(directory: Path) -> Path:
    return directory
