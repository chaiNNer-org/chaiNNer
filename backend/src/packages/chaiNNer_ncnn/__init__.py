from sanic.log import logger

from api import MB, Dependency, add_package
from system import is_arm_mac, is_mac

general = "NCNN 使用 .bin/.param 模型来升级图像。"
recommendation = "推荐AMD用户使用"

if is_arm_mac:
    inst_hint = general
elif is_mac:
    inst_hint = f"{general} {recommendation}."
else:
    inst_hint = (
        f"{general} {recommendation} 因为它同时支持 AMD 和 Nvidia GPU。"
    )


package = add_package(
    __file__,
    id="chaiNNer_ncnn",
    name="NCNN",
    description=(
        f"{general} 模型可以转换为 NCNN，这需要安装 ONNX。\n\nNCNN 利用 Vulkan 进行 GPU 加速，因此支持任何现代 GPU。"
        " 但是在某些情况下，由于 Vulkan 上的 NCNN 处于实验阶段，GPU 放大可能会失败。"
    ),
    dependencies=[
        Dependency(
            display_name="NCNN",
            pypi_name="ncnn-vulkan",
            version="2023.6.18",
            size_estimate=7 * MB if is_mac else 4 * MB,
            import_name="ncnn_vulkan",
        ),
    ],
    icon="NCNN",
    color="#ED64A6",
)

ncnn_category = package.add_category(
    name="NCNN",
    description="使用 NCNN 神经网络框架处理图像的节点。",
    icon="NCNN",
    color="#ED64A6",
    install_hint=inst_hint,
)

logger.debug(f"加载了包 {package.name}")
