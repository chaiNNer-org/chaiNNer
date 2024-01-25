from __future__ import annotations

from nodes.properties.inputs import TextInput

from .. import text_group


@text_group.register(
    schema_id="chainner:utility:note",
    name="Note",
    description="Make a sticky note for whatever notes or comments you want to leave in the chain.",
    icon="MdOutlineStickyNote2",
    inputs=[
        TextInput(
            label="Note Text",
            multiline=True,
            has_handle=False,
            label_style="hidden",
        ).make_optional(),
    ],
    outputs=[],
)
def note_node(_text: str | None) -> None:
    return
