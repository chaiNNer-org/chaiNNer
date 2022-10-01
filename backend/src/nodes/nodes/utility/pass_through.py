"""
Nodes that provide various generic utility
"""

from __future__ import annotations

from typing import Any

from ...categories import UtilityCategory

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import AnyInput
from ...properties.outputs import BaseOutput


@NodeFactory.register("chainner:utility:pass_through")
class PassThroughNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Outputs the input value as is."
        self.inputs = [AnyInput(label="Value")]
        self.outputs = [BaseOutput(output_type="Input0", label="Value")]

        self.category = UtilityCategory
        self.name = "Pass Through"
        self.icon = "MdDoubleArrow"
        self.sub = "Value"

    def run(self, value: Any) -> Any:
        return value
