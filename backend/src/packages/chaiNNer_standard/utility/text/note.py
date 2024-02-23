from __future__ import annotations

from nodes.properties.inputs import BoolInput, TextInput

from .. import text_group


# This node is a bit special as it has special handling by the frontend. Changes made here will not necessarily be reflected in the frontend.
@text_group.register(
    schema_id="chainner:utility:note",
    name="备注",
    description="创建一个便签，用于记录在链中留下的任何备注或注释。支持Markdown语法",
    icon="MdOutlineStickyNote2",
    inputs=[
        TextInput(
            label="备注文本",
            multiline=True,
            has_handle=False,
            label_style="hidden",
        ).make_optional(),
        BoolInput(
            label="显示Markdown",
            default=False,
        ),
    ],
    outputs=[],
)
def note_node(_text: str | None, display_markdown: bool) -> None:
    return
