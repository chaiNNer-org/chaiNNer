import sys

from sanic.log import logger

from api import GB, KB, MB, Dependency, add_package
from gpu import nvidia_is_available
from system import is_arm_mac

python_version = sys.version_info

general = "PyTorch uses .pth models to upscale images."

if is_arm_mac:
    package_description = general
    inst_hint = f"{general} It is the most widely-used upscaling architecture."
else:
    package_description = (
        f"{general} and is fastest when CUDA is supported (Nvidia GPU). If CUDA is"
        " unsupported, it will install with CPU support (which is very slow)."
    )
    inst_hint = (
        f"{general} It is the most widely-used upscaling architecture. However, it does"
        " not support AMD GPUs."
    )


def get_pytorch():
    if is_arm_mac:
        return [
            Dependency(
                display_name="PyTorch",
                pypi_name="torch",
                version="2.1.2",
                size_estimate=55.8 * MB,
            ),
            Dependency(
                display_name="TorchVision",
                pypi_name="torchvision",
                version="0.16.2",
                size_estimate=1.3 * MB,
            ),
        ]
    else:
        return [
            Dependency(
                display_name="PyTorch",
                pypi_name="torch",
                version="2.1.2+cu121" if nvidia_is_available else "2.1.2+cpu",
                size_estimate=2 * GB if nvidia_is_available else 140 * MB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu121"
                    if nvidia_is_available
                    else "https://download.pytorch.org/whl/cpu"
                ),
            ),
            Dependency(
                display_name="TorchVision",
                pypi_name="torchvision",
                version="0.16.2+cu121" if nvidia_is_available else "0.16.2+cpu",
                size_estimate=2 * MB if nvidia_is_available else 800 * KB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu121"
                    if nvidia_is_available
                    else "https://download.pytorch.org/whl/cpu"
                ),
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
            version="0.1.7",
            size_estimate=287 * KB,
        ),
    ],
    icon="PyTorch",
    color="#DD6B20",
)

pytorch_category = package.add_category(
    name="PyTorch",
    description="Nodes for using the PyTorch Neural Network Framework with images.",
    icon="PyTorch",
    color="#DD6B20",
    install_hint=inst_hint,
)

logger.debug(f"Loaded package {package.name}")
