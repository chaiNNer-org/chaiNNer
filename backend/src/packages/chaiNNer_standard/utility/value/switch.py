from __future__ import annotations

from enum import Enum

from nodes.groups import optional_list_group
from nodes.properties.inputs import AnyInput, EnumInput
from nodes.properties.outputs import BaseOutput
from nodes.utils.utils import ALPHABET

from .. import value_group


class ValueIndex(Enum):
    A = 0
    B = 1
    C = 2
    D = 3
    E = 4
    F = 5
    G = 6
    H = 7
    I = 8
    J = 9


@value_group.register(
    schema_id="chainner:utility:switch",
    name="切换",
    description="允许传入多个输入，然后更改通过到输出的输入。",
    icon="BsShuffle",
    inputs=[
        EnumInput(ValueIndex),
        AnyInput(label="值 A"),
        AnyInput(label="值 B"),
        optional_list_group(
            *[
                AnyInput(label=f"值 {letter}").make_optional()
                for letter in ALPHABET[2:10]
            ],
        ),
    ],
    outputs=[
        BaseOutput(
            output_type="""
            let value = match Input0 {
                ValueIndex::A => Input1,
                ValueIndex::B => Input2,
                ValueIndex::C => Input3,
                ValueIndex::D => Input4,
                ValueIndex::E => Input5,
                ValueIndex::F => Input6,
                ValueIndex::G => Input7,
                ValueIndex::H => Input8,
                ValueIndex::I => Input9,
                ValueIndex::J => Input10,
                _ => never
            };

            match value {
                null => never,
                _ => value
            }
            """,
            label="值",
        ).with_never_reason("所选值应该有连接。")
    ],
    see_also=["chainner:utility:pass_through"],
)
def switch_node(selection: ValueIndex, *args: object | None) -> object:
    if args[selection.value] is not None:
        return args[selection.value]
    raise RuntimeError(
        "选择的值无效。所选的值应该有连接。"
    )
