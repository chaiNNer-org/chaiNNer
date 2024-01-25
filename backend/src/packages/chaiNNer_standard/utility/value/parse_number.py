from __future__ import annotations

from nodes.properties.inputs import NumberInput, TextInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:parse_number",
    name="Parse Number",
    description="Parses text to base-10.",
    icon="MdCalculate",
    inputs=[
        TextInput("Text", label_style="inline"),
        NumberInput("Base", default=10, minimum=2, maximum=36),
    ],
    outputs=[
        NumberOutput(
            "Value",
            output_type="int & number::parseInt(Input0, Input1)",
        ).with_never_reason("The given text cannot be parsed into a number."),
    ],
)
def parse_number_node(text: str, base: int) -> int:
    return int(text, base)
