from __future__ import annotations

from .. import expression
from .base_output import BaseOutput


class FileOutput(BaseOutput):
    """Output for saving a local file"""

    def __init__(self, file_type: expression.ExpressionJson, label: str):
        super().__init__(file_type, label)

    def get_broadcast_data(self, value: str):
        return value

    def enforce(self, value) -> str:
        assert isinstance(value, str)
        return value


class DirectoryOutput(BaseOutput):
    """Output for saving to a directory"""

    def __init__(self, label: str = "Directory", of_input: int | None = None):
        directory_type = (
            "Directory"
            if of_input is None
            else f"splitFilePath(Input{of_input}.path).dir"
        )

        super().__init__(directory_type, label)

    def get_broadcast_type(self, value: str):
        return expression.named("Directory", {"path": expression.literal(value)})

    def enforce(self, value) -> str:
        assert isinstance(value, str)
        return value
