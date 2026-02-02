from __future__ import annotations

from api import Collector, IteratorInputInfo
from nodes.properties.inputs import TextInput
from nodes.properties.outputs import TextOutput

from .. import text_group


@text_group.register(
    schema_id="chainner:utility:collect_append_text",
    name="Collect & Append Text",
    description=[
        "Collects all text items from a sequence and appends them together using a separator string.",
        "This is useful for joining text from multiple iterations into a single string.",
    ],
    icon="MdTextFields",
    kind="collector",
    inputs=[
        TextInput("Text Sequence", has_handle=True),
        TextInput(
            "Separator",
            has_handle=False,
            min_length=0,
            max_length=None,
            default="\n",
            allow_empty_string=True,
        ).with_id(1),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    outputs=[
        TextOutput(
            "Output Text",
            output_type="string",
        )
    ],
    see_also=["chainner:utility:text_append"],
)
def collect_and_append_text_node(_: None, separator: str) -> Collector[str, str]:
    texts: list[str] = []

    def on_iterate(text: str):
        texts.append(text)

    def on_complete():
        return separator.join(texts)

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
