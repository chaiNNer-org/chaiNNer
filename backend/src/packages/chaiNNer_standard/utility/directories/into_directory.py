from __future__ import annotations

from pathlib import Path

from nodes.properties.inputs import BoolInput, DirectoryInput, TextInput
from nodes.properties.outputs import DirectoryOutput

from .. import value_group


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
        BoolInput("Create if not exists", default=True),
    ],
    outputs=[
        DirectoryOutput(
            "Directory",
            output_type="Directory { path: combinePath(Input0.path, Input1) }",
        ),
    ],
)
def into_directory_node(directory: Path, folder: str, create_path: bool) -> Path:
    resolved = (directory / folder).resolve()
    if create_path and not resolved.exists():
        resolved.mkdir(parents=True)
    elif not resolved.exists():
        raise FileNotFoundError(f"Directory does not exist: {resolved}")
    return resolved
