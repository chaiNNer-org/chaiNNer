from .. import tensorrt_category

if tensorrt_category is not None:
    io_group = tensorrt_category.add_node_group("Input & Output")
    processing_group = tensorrt_category.add_node_group("Processing")
    utility_group = tensorrt_category.add_node_group("Utility")
else:
    io_group = None  # type: ignore
    processing_group = None  # type: ignore
    utility_group = None  # type: ignore
