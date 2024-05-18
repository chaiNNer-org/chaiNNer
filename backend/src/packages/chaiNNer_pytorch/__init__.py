import os

from sanic.log import logger

from api import GB, KB, MB, Dependency, add_package
from gpu import nvidia
from system import is_arm_mac

general = "PyTorch uses .pth models to upscale images."

if is_arm_mac:
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
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
                version="2.1.2+cu121" if nvidia.is_available else "2.1.2",
                size_estimate=2 * GB if nvidia.is_available else 140 * MB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu121"
                    if nvidia.is_available
                    else "https://download.pytorch.org/whl/cpu"
                ),
                auto_update=not nvidia.is_available,  # Too large to auto-update
            ),
            Dependency(
                display_name="TorchVision",
                pypi_name="torchvision",
                version="0.16.2+cu121" if nvidia.is_available else "0.16.2",
                size_estimate=2 * MB if nvidia.is_available else 800 * KB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu121"
                    if nvidia.is_available
                    else "https://download.pytorch.org/whl/cpu"
                ),
                auto_update=not nvidia.is_available,  # Needs to match PyTorch version
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
            version="0.3.4",
            size_estimate=264 * KB,
        ),
        Dependency(
            display_name="Spandrel extra architectures",
            pypi_name="spandrel_extra_arches",
            version="0.1.1",
            size_estimate=83 * KB,
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
