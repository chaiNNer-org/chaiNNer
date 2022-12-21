from __future__ import annotations

from typing import Union

from ....api.node_base import NodeBase
from ....api.inputs import NoteTextAreaInput


class Note(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Make a sticky note for whatever notes or comments you want to leave in the chain."
        self.inputs = [
            NoteTextAreaInput().make_optional(),
        ]
        self.outputs = []

        self.name = "Note"
        self.icon = "MdOutlineStickyNote2"

    def run(self, _text: Union[str, None]) -> None:
        return
