from .. import image_dimensions_category

padding_group = image_dimensions_category.add_node_group("Padding")
crop_group = image_dimensions_category.add_node_group("Crop")
resize_group = image_dimensions_category.add_node_group("Resize")
utility_group = image_dimensions_category.add_node_group("Utility")

resize_group.order = [
    "chainner:image:resize",
    "chainner:image:resize_to_side",
]
