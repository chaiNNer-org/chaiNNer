from sanic.log import logger

from api import MB, Dependency, add_package
from system import is_mac

package = add_package(
    __file__,
    name="NCNN",
    description="NCNN uses .bin/.param models to upscale images. NCNN uses Vulkan for GPU acceleration, meaning it supports any modern GPU. Models can be converted from PyTorch to NCNN.",
    dependencies=[
        Dependency(
            "NCNN",
            "ncnn-vulkan",
            "2022.9.12",
            7 * MB if is_mac else 4 * MB,
            auto_update=True,
            import_name="ncnn_vulkan",
        ),
    ],
)

ncnn_category = package.add_category(
    name="NCNN",
    description="Nodes for using the NCNN Neural Network Framework with images.",
    icon="NCNN",
    color="#ED64A6",
    install_hint="NCNN uses .bin/.param models to upscale images. It is recommended for AMD users because it supports both AMD and Nvidia GPUs.",
)


logger.debug(f"Loaded package {package.name}")
