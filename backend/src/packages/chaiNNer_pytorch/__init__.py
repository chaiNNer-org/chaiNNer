import sys

from sanic.log import logger

from api import GB, KB, MB, Dependency, DropdownSetting, ToggleSetting, add_package
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
    # 1.13.1 can take advantage of MPS
    if is_arm_mac:
        return [
            Dependency(
                display_name="PyTorch",
                pypi_name="torch",
                version="1.13.1",
                size_estimate=140 * MB,
            ),
            Dependency(
                display_name="TorchVision",
                pypi_name="torchvision",
                version="0.14.1",
                size_estimate=1.3 * MB,
            ),
        ]
    if python_version.minor < 10:
        # <= 3.9
        return [
            Dependency(
                display_name="PyTorch",
                pypi_name="torch",
                version="1.10.2+cu113" if nvidia_is_available else "1.10.2",
                size_estimate=2 * GB if nvidia_is_available else 140 * MB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu113"
                    if nvidia_is_available
                    else None
                ),
            ),
            Dependency(
                display_name="TorchVision",
                pypi_name="torchvision",
                version="0.11.3+cu113" if nvidia_is_available else "0.11.3",
                size_estimate=2 * MB if nvidia_is_available else 800 * KB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu113"
                    if nvidia_is_available
                    else None
                ),
            ),
        ]
    else:
        # >= 3.10
        return [
            Dependency(
                display_name="PyTorch",
                pypi_name="torch",
                version="1.12.1+cu116" if nvidia_is_available else "1.12.1",
                size_estimate=2 * GB if nvidia_is_available else 140 * MB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu116"
                    if nvidia_is_available
                    else None
                ),
            ),
            Dependency(
                display_name="TorchVision",
                pypi_name="torchvision",
                version="0.13.1+cu116" if nvidia_is_available else "0.13.1",
                size_estimate=2 * MB if nvidia_is_available else 800 * KB,
                extra_index_url=(
                    "https://download.pytorch.org/whl/cu116"
                    if nvidia_is_available
                    else None
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
            version="0.2.5",
            size_estimate=1.1 * MB,
        ),
        Dependency(
            display_name="Einops",
            pypi_name="einops",
            version="0.5.0",
            size_estimate=36.5 * KB,
        ),
    ],
    icon="PyTorch",
    color="#DD6B20",
)

package.add_setting(
    ToggleSetting(
        label="CPU Mode",
        key="cpu_mode",
        description="Use CPU for PyTorch instead of GPU. This is much slower and not recommended.",
        default=False,
    ),
)

package.add_setting(
    ToggleSetting(
        label="FP16 Mode",
        key="fp16_mode",
        description=(
            "Runs PyTorch in half-precision (FP16) mode for less RAM usage."
            if is_arm_mac
            else "Runs PyTorch in half-precision (FP16) mode for less VRAM usage. RTX GPUs also get a speedup."
        ),
        default=False,
    ),
)

if not is_arm_mac:
    gpu_list = []
    try:
        import torch

        for i in range(torch.cuda.device_count()):
            device_name = torch.cuda.get_device_properties(i).name
            gpu_list.append(device_name)
    except:
        pass

    package.add_setting(
        DropdownSetting(
            label="GPU",
            key="gpu",
            description="Which GPU to use for PyTorch. This is only relevant if you have multiple GPUs.",
            options=[{"label": x, "value": str(i)} for i, x in enumerate(gpu_list)],
            default="0",
            disabled=len(gpu_list) <= 1,
        )
    )

pytorch_category = package.add_category(
    name="PyTorch",
    description="Nodes for using the PyTorch Neural Network Framework with images.",
    icon="PyTorch",
    color="#DD6B20",
    install_hint=inst_hint,
)

logger.debug(f"Loaded package {package.name}")
