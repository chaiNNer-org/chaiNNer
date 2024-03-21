from __future__ import annotations

from pathlib import Path

from nodes.properties.inputs import DirectoryInput
from nodes.properties.outputs import TextOutput

from .. import directory_group


@directory_group.register(
    schema_id="chainner:utility:directory_to_text",
    name="Directory to Text",
    description="Converts a directory path into text.",
    icon="BsFolder",
    inputs=[
        DirectoryInput(must_exist=False, label_style="hidden"),
    ],
    outputs=[
        TextOutput(
            "Dir Text",
            output_type="Input0.path",
        ),
    ],
)
def directory_to_text_node(directory: Path) -> str:
    return str(directory)
