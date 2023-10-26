from api import MB, Dependency, add_package
from sanic.log import logger
from system import is_arm_mac, is_mac

general = "NCNN uses .bin/.param models to upscale images."
recommendation = "It is recommended for AMD users"

if is_arm_mac:
    inst_hint = general
elif is_mac:
    inst_hint = f"{general} {recommendation}."
else:
    inst_hint = (
        f"{general} {recommendation} because it supports both AMD and Nvidia GPUs."
    )


package = add_package(
    __file__,
    id="chaiNNer_ncnn",
    name="NCNN",
    description=(
        f"{general} Models can be converted from PyTorch to NCNN, which requires ONNX"
        " to be installed as well.\n\nNCNN utilizes Vulkan for GPU acceleration,"
        " meaning it supports any modern GPU. However, in some cases GPU upscaling"
        " may fail, due to NCNN on Vulkan being experimental."
    ),
    dependencies=[
        Dependency(
            display_name="NCNN",
            pypi_name="ncnn-vulkan",
            version="2023.6.18",
            size_estimate=7 * MB if is_mac else 4 * MB,
            auto_update=True,
            import_name="ncnn_vulkan",
        ),
    ],
    icon="NCNN",
    color="#ED64A6",
)

ncnn_category = package.add_category(
    name="NCNN",
    description="Nodes for using the NCNN Neural Network Framework with images.",
    icon="NCNN",
    color="#ED64A6",
    install_hint=inst_hint,
)

logger.debug(f"Loaded package {package.name}")
