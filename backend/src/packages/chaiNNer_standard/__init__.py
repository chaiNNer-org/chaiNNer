from sanic.log import logger

from api import add_package

package = add_package(__file__, name="chaiNNer_standard", dependencies=[])

image_category = package.add_category(
    name="Image",
    description="Base image nodes.",
    icon="BsFillImageFill",
    color="#C53030",
)

image_adjustments_category = package.add_category(
    name="Image (Adjustments)",
    description="Nodes that deal with adjusting properties of images.",
    icon="BsSliders",
    color="#319795",
)

logger.info(f"Loaded package {package.name}")
