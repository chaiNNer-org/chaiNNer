import sys

from sanic.log import logger

from api import GB, KB, MB, Dependency, add_package
from gpu import nvidia_is_available
from system import is_arm_mac

python_version = sys.version_info

general = "PyTorch uses .pth models to upscale images."

if is_arm_mac:
    package_description = general
    inst_hint = f"{general} 它是最广泛使用的升级架构。"
else:
    package_description = (
        f"{general} 且在支持 CUDA（Nvidia GPU）的情况下运行最快。如果不支持 CUDA，则会使用 CPU 支持进行安装（速度较慢）。"
    )
    inst_hint = (
        f"{general} 是最广泛使用的放大架构之一。然而，它不支持 AMD GPU。"
    )


def get_pytorch():
    if is_arm_mac:
        return [
            Dependency(
                display_name="PyTorch",
                pypi_name="torch",
                version="2.1.2",
                size_estimate=55.8 * MB,
                auto_update=True,
            ),
            Dependency(
                display_name="TorchVision",
                pypi_name="torchvision",
                version="0.16.2",
                size_estimate=1.3 * MB,
                auto_update=True,
            ),
        ]
    else:
        return [
            Dependency(
                display_name="PyTorch",
                pypi_name="torch",
                version="2.1.2+cu121" if nvidia_is_available else "2.1.2",
                size_estimate=2 * GB if nvidia_is_available else 140 * MB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu121"
                    if nvidia_is_available
                    else "https://download.pytorch.org/whl/cpu"
                ),
                auto_update=not nvidia_is_available,  # Too large to auto-update
            ),
            Dependency(
                display_name="TorchVision",
                pypi_name="torchvision",
                version="0.16.2+cu121" if nvidia_is_available else "0.16.2",
                size_estimate=2 * MB if nvidia_is_available else 800 * KB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu121"
                    if nvidia_is_available
                    else "https://download.pytorch.org/whl/cpu"
                ),
                auto_update=not nvidia_is_available,  # Needs to match PyTorch version
            ),
        ]


package = add_package(
    __file__,
    id="chaiNNer_pytorch",
    name="PyTorch",
    description=package_description,
    dependencies=[
        *get_pytorch(),
        Dependency(
            display_name="FaceXLib",
            pypi_name="facexlib",
            version="0.3.0",
            size_estimate=59.6 * KB,
        ),
        Dependency(
            display_name="Einops",
            pypi_name="einops",
            version="0.6.1",
            size_estimate=42.2 * KB,
        ),
        Dependency(
            display_name="safetensors",
            pypi_name="safetensors",
            version="0.4.0",
            size_estimate=1 * MB,
        ),
        Dependency(
            display_name="Spandrel",
            pypi_name="spandrel",
            version="0.2.2",
            size_estimate=287 * KB,
        ),
    ],
    icon="PyTorch",
    color="#DD6B20",
)

pytorch_category = package.add_category(
    name="PyTorch",
    description="用于将 PyTorch 神经网络框架与图像结合使用的节点。",
    icon="PyTorch",
    color="#DD6B20",
    install_hint=inst_hint,
)

logger.debug(f"已加载的包 {package.name}")
