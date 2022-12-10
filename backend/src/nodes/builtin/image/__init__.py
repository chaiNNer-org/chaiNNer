from ...api.category import Category
from ...api.sub_category import SubCategory
from ...api.safe_node_import import i

input_and_output = SubCategory(
    name="Input & Output",
    description="Nodes for reading and writing image data.",
    nodes=[
        i("load_image", "ImReadNode"),
        i("save_image", "ImWriteNode"),
        i("view_image", "ImViewNode"),
        i("external_preview", "ImOpenNode"),
    ],
)

category = Category(
    name="Image",
    description="Base image nodes.",
    icon="BsFillImageFill",
    color="#C53030",
    sub_categories=[input_and_output],
)
