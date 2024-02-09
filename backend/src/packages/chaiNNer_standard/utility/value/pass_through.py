from __future__ import annotations

from nodes.groups import optional_list_group
from nodes.properties.inputs import AnyInput
from nodes.properties.outputs import AnyOutput

from .. import value_group


@value_group.register(
    schema_id="chainner:utility:pass_through",
    name="Pass Through",
    description="Outputs the input value as is. Supports up to 10 inputs.",
    icon="MdDoubleArrow",
    inputs=[
        AnyInput(label="Value 1").make_fused(0),
        optional_list_group(
            AnyInput(label="Value 2").make_fused(1).make_optional(),
            AnyInput(label="Value 3").make_fused(2).make_optional(),
            AnyInput(label="Value 4").make_fused(3).make_optional(),
            AnyInput(label="Value 5").make_fused(4).make_optional(),
            AnyInput(label="Value 6").make_fused(5).make_optional(),
            AnyInput(label="Value 7").make_fused(6).make_optional(),
            AnyInput(label="Value 8").make_fused(7).make_optional(),
            AnyInput(label="Value 9").make_fused(8).make_optional(),
            AnyInput(label="Value 10").make_fused(9).make_optional(),
        ),
    ],
    outputs=[
        AnyOutput(output_type="Input0", label="Value 1"),
        AnyOutput(output_type="Input1", label="Value 2"),
        AnyOutput(output_type="Input2", label="Value 3"),
        AnyOutput(output_type="Input3", label="Value 4"),
        AnyOutput(output_type="Input4", label="Value 5"),
        AnyOutput(output_type="Input5", label="Value 6"),
        AnyOutput(output_type="Input6", label="Value 7"),
        AnyOutput(output_type="Input7", label="Value 8"),
        AnyOutput(output_type="Input8", label="Value 9"),
        AnyOutput(output_type="Input9", label="Value 10"),
    ],
)
def pass_through_node(
    value_a: object,
    value_b: object | None = None,
    value_c: object | None = None,
    value_d: object | None = None,
    value_e: object | None = None,
    value_f: object | None = None,
    value_g: object | None = None,
    value_h: object | None = None,
    value_i: object | None = None,
    value_j: object | None = None,
) -> tuple[
    object, object, object, object, object, object, object, object, object, object
]:
    return (
        value_a,
        value_b,
        value_c,
        value_d,
        value_e,
        value_f,
        value_g,
        value_h,
        value_i,
        value_j,
    )
