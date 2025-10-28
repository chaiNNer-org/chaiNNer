from __future__ import annotations

from api import IteratorInputInfo, IteratorOutputInfo, Transformer
from nodes.properties.inputs import NumberInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


class AnyValueInput:
    """Generic input that accepts any value type."""

    def __init__(self, label: str, input_id: int = -1):
        from api import BaseInput

        self.base = BaseInput(
            input_type="any",
            label=label,
            kind="generic",
            has_handle=True,
            associated_type=object,
        )
        if input_id != -1:
            self.base.id = input_id


class AnyValueOutput:
    """Generic output that can output any value type."""

    def __init__(self, label: str, output_id: int = -1):
        from api import BaseOutput

        self.base = BaseOutput(
            output_type="any",
            label=label,
            kind="generic",
            has_handle=True,
            associated_type=object,
        )
        if output_id != -1:
            self.base.id = output_id


@value_group.register(
    schema_id="chainner:utility:limit",
    name="Limit",
    description="Limits the number of items in an iterator sequence. Only the first N items will pass through.",
    icon="MdFilterList",
    inputs=[
        AnyValueInput("Input").base,
        NumberInput("Limit", default=10, min=0, max=None),
    ],
    outputs=[
        AnyValueOutput("Output").base,
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    iterator_outputs=IteratorOutputInfo(outputs=0),
    kind="transformer",
)
def limit_node(_: None, limit: int) -> Transformer:
    count = [0]  # Use list to allow mutation in closure

    def transform(value: object) -> list[object]:
        if count[0] < limit:
            count[0] += 1
            return [value]
        return []

    return Transformer(transform=transform)
