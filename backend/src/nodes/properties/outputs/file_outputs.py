from __future__ import annotations

from pathlib import Path

import navi
from api import BaseOutput


class DirectoryOutput(BaseOutput):
    """Output for saving to a directory"""

    def __init__(
        self,
        label: str = "Directory",
        of_input: int | None = None,
        output_type: str = "Directory",
    ):
        directory_type = (
            "Directory"
            if of_input is None
            else f"splitFilePath(Input{of_input}.path).dir"
        )
        directory_type = navi.intersect_with_error(directory_type, output_type)
        super().__init__(directory_type, label, associated_type=Path)

    def get_broadcast_type(self, value: Path):
        return navi.named("Directory", {"path": navi.literal(str(value))})

    def enforce(self, value: object) -> Path:
        assert isinstance(value, Path)
        return value
