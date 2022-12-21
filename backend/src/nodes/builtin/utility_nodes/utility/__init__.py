from ....api.category import Category
from ....api.sub_category import SubCategory
from ....api.safe_node_import import i

clipboard_subcat = SubCategory(
    name="Clipboard",
    description="Nodes for reading and writing to the clipboard.",
    nodes=[
        i("copy_to_clipboard", "Copy_To_Clipboard"),
    ],
)

math_subcat = SubCategory(
    name="Math",
    description="Nodes for performing mathematical operations.",
    nodes=[
        i("math_node", "Math"),
    ],
)

text_subcat = SubCategory(
    name="Text",
    description="Nodes for performing operations on text.",
    nodes=[
        i("note", "Note"),
    ],
)

value_subcat = SubCategory(
    name="Value",
    description="Nodes for dealing with values.",
    nodes=[
        i("pass_through", "Pass_Through"),
    ],
)

category = Category(
    name="Utility",
    description="Various utility nodes.",
    icon="BsGearFill",
    color="#718096",
    sub_categories=[math_subcat, clipboard_subcat, text_subcat, value_subcat],
)
