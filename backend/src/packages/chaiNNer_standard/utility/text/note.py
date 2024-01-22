from __future__ import annotations

from nodes.properties.inputs import BoolInput, TextInput

from .. import text_group


# This node is a bit special as it has special handling by the frontend. Changes made here will not necessarily be reflected in the frontend.
@text_group.register(
    schema_id="chainner:utility:note",
    name="Note",
    description="Make a sticky note for whatever notes or comments you want to leave in the chain. Supports markdown syntax",
    icon="MdOutlineStickyNote2",
    inputs=[
        TextInput(
            label="Note Text",
            multiline=True,
            has_handle=False,
            hide_label=True,
        ).make_optional(),
        BoolInput(
            label="Display Markdown",
            default=False,
        ),
    ],
    outputs=[],
)
def note_node(_text: str | None, display_markdown: bool) -> None:
    return
