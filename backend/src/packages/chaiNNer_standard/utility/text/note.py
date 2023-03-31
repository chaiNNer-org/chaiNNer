from __future__ import annotations

from typing import Union

from nodes.properties.inputs import TextAreaInput

from .. import text_group


@text_group.register(
    schema_id="chainner:utility:note",
    name="Note",
    description="Make a sticky note for whatever notes or comments you want to leave in the chain.",
    icon="MdOutlineStickyNote2",
    inputs=[
        TextAreaInput(label="Note Text").make_optional(),
    ],
    outputs=[],
)
def note_node(_text: Union[str, None]) -> None:
    return
