from __future__ import annotations

import navi
from nodes.base_output import BaseOutput


class DirectoryOutput(BaseOutput):
    """Output for saving to a directory"""

    def __init__(self, label: str = "Directory", of_input: int | None = None):
        directory_type = (
            "Directory"
            if of_input is None
            else f"splitFilePath(Input{of_input}.path).dir"
        )

        super().__init__(directory_type, label, associated_type=str)

    def get_broadcast_type(self, value: str):
        return navi.named("Directory", {"path": navi.literal(value)})

    def enforce(self, value) -> str:
        assert isinstance(value, str)
        return value
