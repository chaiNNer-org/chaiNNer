from sanic.log import logger

from api import KB, MB, Dependency, add_package

package = add_package(
    __file__,
    id="chaiNNer_standard",
    name="chaiNNer_standard",
    description="The standard set of nodes for chaiNNer.",
    dependencies=[
        Dependency(
            display_name="Numpy",
            pypi_name="numpy",
            version="1.24.4",
            size_estimate=15 * MB,
        ),
        Dependency(
            display_name="OpenCV",
            pypi_name="opencv-python",
            version="4.8.0.76",
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
            display_name="Numba",
            pypi_name="numba",
            version="0.57.1",
            size_estimate=2.5 * MB,
        ),
        Dependency(
            display_name="PyMatting",
            pypi_name="PyMatting",
            import_name="pymatting",
            version="1.1.10",
            size_estimate=52 * KB,
        ),
        Dependency(
            display_name="ChaiNNer Extensions",
            pypi_name="chainner_ext",
            version="0.3.9",
            size_estimate=2.0 * MB,
        ),
    ],
)


image_category = package.add_category(
    name="图像",
    description="基本图像节点。",
    icon="BsFillImageFill",
    color="#C53030",
)

image_dimensions_category = package.add_category(
    name="图像（尺寸）",
    description="处理改变图像尺寸/分辨率的节点。",
    icon="MdOutlinePhotoSizeSelectLarge",
    color="#3182CE",
)

image_adjustments_category = package.add_category(
    name="图像（调整）",
    description="处理调整图像属性的节点。",
    icon="BsSliders",
    color="#319795",
)

image_filter_category = package.add_category(
    name="图像（滤镜）",
    description="处理过滤图像的节点。",
    icon="MdFilterAlt",
    color="#38A169",
)

image_utility_category = package.add_category(
    name="图像（实用工具）",
    description="各种图像实用工具节点。",
    icon="BsGear",
    color="#00A3C4",
)

image_channel_category = package.add_category(
    name="图像（通道）",
    description="处理操纵图像通道的节点。",
    icon="MdAllOut",
    color="#D69E2E",
)

material_textures_category = package.add_category(
    name="材质纹理",
    description="修改和创建游戏和3D模型的材质纹理。",
    icon="GiRolledCloth",
    color="#827DFB",
)

utility_category = package.add_category(
    name="实用工具",
    description="各种实用工具节点。",
    icon="BsGearFill",
    color="#718096",
)

logger.debug(f"加载了包 {package.name}")

