from __future__ import annotations

from typing import Union

from . import category as UtilityCategory

from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import NoteTextAreaInput


@NodeFactory.register("chainner:utility:note")
class NoteNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Make a sticky note for whatever notes or comments you want to leave in the chain."
        self.inputs = [
            NoteTextAreaInput().make_optional(),
        ]
        self.outputs = []

        self.category = UtilityCategory
        self.name = "Note"
        self.icon = "MdOutlineStickyNote2"
        self.sub = "Text"

    def run(self, _text: Union[str, None]) -> None:
        return
