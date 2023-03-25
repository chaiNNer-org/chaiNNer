from sanic.log import logger

from .. import package

image = package.add_category(
    name="Image",
    description="Base image nodes.",
    icon="BsFillImageFill",
    color="#C53030",
)

io = image.add_sub_category("Input & Output")

logger.info(f"Loaded category {image.name}")
