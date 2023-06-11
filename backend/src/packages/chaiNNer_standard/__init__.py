from sanic.log import logger

from api import add_package

package = add_package(
    __file__,
    name="chaiNNer_standard",
    description="The standard set of nodes for chaiNNer.",
    dependencies=[],
)

image_category = package.add_category(
    name="Image",
    description="Base image nodes.",
    icon="BsFillImageFill",
    color="#C53030",
)

image_dimensions_category = package.add_category(
    name="Image (Dimensions)",
    description="Nodes that deal with changing the dimensions/resolution of images.",
    icon="MdOutlinePhotoSizeSelectLarge",
    color="#3182CE",
)

image_adjustments_category = package.add_category(
    name="Image (Adjustments)",
    description="Nodes that deal with adjusting properties of images.",
    icon="BsSliders",
    color="#319795",
)

image_filter_category = package.add_category(
    name="Image (Filters)",
    description="Nodes that deal with filtering images.",
    icon="MdFilterAlt",
    color="#38A169",
)

image_utility_category = package.add_category(
    name="Image (Utilities)",
    description="Various utility nodes for images.",
    icon="BsGear",
    color="#00A3C4",
)

image_channel_category = package.add_category(
    name="Image (Channels)",
    description="Nodes that deal with manipulating channels of images.",
    icon="MdAllOut",
    color="#D69E2E",
)

material_textures_category = package.add_category(
    name="Material Textures",
    description="Modify and create material textures for games & 3D models.",
    icon="GiRolledCloth",
    color="#827DFB",
)

utility_category = package.add_category(
    name="Utility",
    description="Various utility nodes.",
    icon="BsGearFill",
    color="#718096",
)


logger.debug(f"Loaded package {package.name}")
