from sanic.log import logger

from api import KB, MB, Dependency, add_package
from system import is_arm_mac, is_windows

package = add_package(
    __file__,
    id="chaiNNer_standard",
    name="chaiNNer_standard",
    description="The standard set of nodes for chaiNNer.",
    dependencies=[
        Dependency(
            display_name="Numpy",
            pypi_name="numpy",
            version="1.23.2",
            size_estimate=15 * MB,
        ),
        Dependency(
            display_name="OpenCV",
            pypi_name="opencv-python",
            version="4.7.0.68",
            size_estimate=30 * MB,
            import_name="cv2",
        ),
        Dependency(
            display_name="Pillow (PIL)",
            pypi_name="Pillow",
            version="9.2.0",
            size_estimate=3 * MB,
            import_name="PIL",
        ),
        Dependency(
            display_name="appdirs",
            pypi_name="appdirs",
            version="1.4.4",
            size_estimate=13.5 * KB,
        ),
        Dependency(
            display_name="FFMPEG",
            pypi_name="ffmpeg-python",
            version="0.2.0",
            size_estimate=25 * KB,
            import_name="ffmpeg",
        ),
        Dependency(
            display_name="Requests",
            pypi_name="requests",
            version="2.28.2",
            size_estimate=452 * KB,
        ),
        Dependency(
            display_name="re2",
            pypi_name="google-re2",
            version="1.0",
            size_estimate=275 * KB,
            import_name="re2",
        ),
        Dependency(
            display_name="scipy",
            pypi_name="scipy",
            version="1.9.3",
            size_estimate=42 * MB,
        ),
        Dependency(
            display_name="Wildcard Match",
            pypi_name="wcmatch",
            version="8.4.1",
            size_estimate=39 * KB,
            import_name="wcmatch",
        ),
        Dependency(
            display_name="ChaiNNer Extensions",
            pypi_name="chainner_ext",
            version="0.1.0",
            size_estimate=1.5 * MB,
        ),
    ],
)

if is_arm_mac:
    package.add_dependency(
        Dependency(
            display_name="Pasteboard",
            pypi_name="pasteboard",
            version="0.3.3",
            size_estimate=19 * KB,
        )
    )
elif is_windows:
    package.add_dependency(
        Dependency(
            display_name="Pywin32",
            pypi_name="pywin32",
            version="304",
            size_estimate=12 * MB,
            import_name="win32clipboard",
        )
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
