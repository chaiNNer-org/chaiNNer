from sanic.log import logger

from api import MB, Dependency, DropdownSetting, add_package
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
        f"{general} NCNN uses Vulkan for GPU"
        " acceleration, meaning it supports any modern GPU. Models can be converted"
        " from PyTorch to NCNN."
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

if not is_arm_mac:
    gpu_list = []
    try:
        from ncnn_vulkan import ncnn

        for i in range(ncnn.get_gpu_count()):
            gpu_list.append(ncnn.get_gpu_info(i).device_name())
    except:
        gpu_list.append("cpu")

    package.add_setting(
        DropdownSetting(
            label="NCNN GPU",
            key="gpu",
            description="Which GPU to use for NCNN. This is only relevant if you have multiple GPUs.",
            options=gpu_list,
            default=gpu_list[0],
            disabled=len(gpu_list) <= 1,
        )
    )

ncnn_category = package.add_category(
    name="NCNN",
    description="Nodes for using the NCNN Neural Network Framework with images.",
    icon="NCNN",
    color="#ED64A6",
    install_hint=inst_hint,
)

logger.debug(f"Loaded package {package.name}")
