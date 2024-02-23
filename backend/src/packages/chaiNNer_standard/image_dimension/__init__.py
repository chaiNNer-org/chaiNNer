from .. import image_dimensions_category

padding_group = image_dimensions_category.add_node_group("填充")
crop_group = image_dimensions_category.add_node_group("裁剪")
resize_group = image_dimensions_category.add_node_group("调整大小")
utility_group = image_dimensions_category.add_node_group("实用工具")

resize_group.order = [
    "chainner:image:resize",
    "chainner:image:resize_to_side",
]
