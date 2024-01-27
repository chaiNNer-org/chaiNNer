from __future__ import annotations

import sys
from pathlib import Path

from nodes.properties.inputs import DirectoryInput, TextInput
from nodes.properties.outputs import DirectoryOutput

from .. import value_group

separator = r"\\" if sys.platform == "win32" else "/"


@value_group.register(
    schema_id="chainner:utility:into_directory",
    name="Into Directory",
    description="Goes forward into a directory.",
    icon="BsFolder",
    inputs=[
        DirectoryInput(
            "Directory", must_exist=False, label_style="hidden", has_handle=True
        ),
        TextInput("Folder", has_handle=True),
    ],
    outputs=[
        DirectoryOutput(
            "Directory",
            output_type='Directory { path: string::concat(Input0.path, "'
            + separator
            + '", Input1) }',
        ),
    ],
)
def into_directory_node(directory: Path, folder: str) -> Path:
    return directory / folder
