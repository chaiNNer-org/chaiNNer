from __future__ import annotations

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
        super().__init__(directory_type, label, associated_type=str)

    def get_broadcast_type(self, value: str):
        return navi.named("Directory", {"path": navi.literal(value)})

    def enforce(self, value: object) -> str:
        if not isinstance(value, str):
            raise TypeError(f"Expected a string, but got {type(value)}")
        return value
