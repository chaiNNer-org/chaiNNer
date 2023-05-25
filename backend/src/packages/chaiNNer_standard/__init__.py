from sanic.log import logger

from api import KB, MB, Dependency, add_package, is_arm_mac, is_windows

package = add_package(
    __file__,
    name="chaiNNer_standard",
    description="The standard set of nodes for chaiNNer.",
    dependencies=[
        # Dependency("OpenCV", "opencv-python", "4.7.0.68", 30 * MB, import_name="cv2"),
        # Dependency("NumPy", "numpy", "1.23.2", 15 * MB),
        # Dependency("Pillow (PIL)", "Pillow", "9.2.0", 3 * MB, import_name="PIL"),
        # Dependency("appdirs", "appdirs", "1.4.4", 13.5 * KB),
        # Dependency("FFMPEG", "ffmpeg-python", "0.2.0", 25 * KB, import_name="ffmpeg"),
        # Dependency("Requests", "requests", "2.28.2", 452 * KB),
        # Dependency("re2", "google-re2", "1.0", 275 * KB, import_name="re2"),
        # Dependency("scipy", "scipy", "1.9.3", 42 * MB),
    ],
)

if is_arm_mac:
    package.add_dependency(Dependency("Pasteboard", "pasteboard", "0.3.3", 19 * KB))
elif is_windows:
    package.add_dependency(
        Dependency("Pywin32", "pywin32", "304", 12 * MB, import_name="win32clipboard")
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
