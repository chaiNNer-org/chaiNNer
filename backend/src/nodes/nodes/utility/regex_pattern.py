from __future__ import annotations

import re

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import TextInput
from ...properties.outputs import TextOutput
from . import category as UtilityCategory


@NodeFactory.register("chainner:utility:regex_pattern")
class RegexNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Performs regular expression on the given text."
        self.inputs = [
            TextInput("Text", min_length=0),
            TextInput("Regex Pattern", min_length=0),
            TextInput("Replacement", min_length=0),
        ]
        self.outputs = [
            TextOutput("Text", output_type="toString(Input0)"),
        ]
        self.category = UtilityCategory
        self.name = "Regex Replace"
        self.icon = "MdTextFields"
        self.sub = "Regex"

    def run(self, text: str, reg: str, rep: str) -> str:
        return re.sub(reg, rep, text, count=0, flags=0)
