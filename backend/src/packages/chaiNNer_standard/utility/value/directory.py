from __future__ import annotations

from nodes.properties.inputs import DirectoryInput
from nodes.properties.outputs import DirectoryOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:directory",
    name="Directory",
    description="Outputs the given directory.",
    icon="BsFolder",
    inputs=[
        DirectoryInput(
            "Directory", must_exist=False, label_style="hidden", has_handle=True
        ).make_fused(),
    ],
    outputs=[
        DirectoryOutput("Directory", output_type="Input0"),
    ],
)
def directory_node(directory: str) -> str:
    return directory
