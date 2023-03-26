from sanic.log import logger

from .. import package

category = package.add_category(
    name="Image",
    description="Base image nodes.",
    icon="BsFillImageFill",
    color="#C53030",
)


logger.info(f"Loaded category {category.name}")
