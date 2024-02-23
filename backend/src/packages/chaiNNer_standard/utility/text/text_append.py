from __future__ import annotations

from nodes.groups import optional_list_group
from nodes.properties.inputs import TextInput
from nodes.properties.outputs import TextOutput
from nodes.utils.utils import ALPHABET

from .. import text_group


@text_group.register(
    schema_id="chainner:utility:text_append",
    name="文本追加",
    description=[
        "使用分隔符字符串将不同的文本连接在一起。",
        "这是将文本字符串连接在一起的最简单方法。",
    ],
    icon="MdTextFields",
    inputs=[
        TextInput(
            "分隔符",
            has_handle=False,
            min_length=0,
            max_length=3,
            default="-",
            allow_empty_string=True,
        ),
        TextInput("文本A"),
        TextInput("文本B"),
        optional_list_group(
            *[TextInput(f"文本{letter}").make_optional() for letter in ALPHABET[2:10]],
        ),
    ],
    outputs=[
        TextOutput(
            "输出文本",
            output_type="""
                let sep = Input0;
                string::concat(
                    Input1,
                    sep,
                    Input2,
                    match Input3 { null => "", _ as s => string::concat(sep, s) },
                    match Input4 { null => "", _ as s => string::concat(sep, s) },
                    match Input5 { null => "", _ as s => string::concat(sep, s) },
                    match Input6 { null => "", _ as s => string::concat(sep, s) },
                    match Input7 { null => "", _ as s => string::concat(sep, s) },
                    match Input8 { null => "", _ as s => string::concat(sep, s) },
                    match Input9 { null => "", _ as s => string::concat(sep, s) },
                    match Input10 { null => "", _ as s => string::concat(sep, s) }
                )
            """,
        )
    ],
    see_also=["chainner:utility:text_pattern"],
)
def text_append_node(separator: str, *args: str | None) -> str:
    inputs: list[str | None] = [*args]
    return separator.join([x for x in inputs if x is not None])
