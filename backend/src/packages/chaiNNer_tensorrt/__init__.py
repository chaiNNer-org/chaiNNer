from api import GB, MB, Dependency, add_package
from gpu import nvidia
from logger import logger
from system import is_arm_mac

package_description = (
    "TensorRT provides native NVIDIA TensorRT support for optimized GPU inference. "
    "It offers significant performance improvements over ONNX Runtime by using "
    "NVIDIA's proprietary optimization engine. Engines are built specifically for "
    "your GPU architecture for maximum performance."
)

install_hint = (
    "TensorRT uses NVIDIA's TensorRT engine for GPU-accelerated inference. "
    "Requires an NVIDIA GPU with CUDA support."
)

# Always register the package so dependencies are installed in CI
package = add_package(
    __file__,
    id="chaiNNer_tensorrt",
    name="TensorRT",
    description=package_description,
    dependencies=[
        Dependency(
            display_name="TensorRT",
            pypi_name="tensorrt",
            version="10.15.1.29",
            size_estimate=int(1.2 * GB),
            auto_update=False,
        ),
        Dependency(
            display_name="CUDA Python",
            pypi_name="cuda-python",
            version="13.1.1",
            size_estimate=20 * MB,
        ),
    ],
    icon="BsNvidia",
    color="#76B900",
)

if not nvidia.is_available:
    package.disabled = True
    package.disabled_reason = "TensorRT requires an NVIDIA GPU with CUDA support"

if nvidia.is_available and not is_arm_mac:
    tensorrt_category = package.add_category(
        name="TensorRT",
        description="Nodes for using NVIDIA TensorRT for optimized GPU inference.",
        icon="BsNvidia",
        color="#76B900",
        install_hint=install_hint,
    )
    logger.debug("Loaded package %s", package.name)
else:
    tensorrt_category = None  # type: ignore
