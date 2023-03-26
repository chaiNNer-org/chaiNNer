from sanic.log import logger

from .. import image_category as category

logger.info(f"Loaded category {category.name}")

io_group = category.add_node_group("Input & Output")
create_images_group = category.add_node_group("Create Images")
batch_processing_group = category.add_node_group("Batch Processing")
