"""
Nodes that provide various generic utility
"""

from __future__ import annotations

from typing import Any

from ....api.node_base import NodeBase
from ....api.inputs import AnyInput
from ....api.outputs import BaseOutput


class Pass_Through(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Outputs the input value as is."
        self.inputs = [AnyInput(label="Value")]
        self.outputs = [BaseOutput(output_type="Input0", label="Value")]

        self.name = "Pass Through"
        self.icon = "MdDoubleArrow"

    def run(self, value: Any) -> Any:
        return value
