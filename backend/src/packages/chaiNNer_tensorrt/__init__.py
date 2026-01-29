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

# Only define the package if NVIDIA GPUs are available
if nvidia.is_available and not is_arm_mac:
    package = add_package(
        __file__,
        id="chaiNNer_tensorrt",
        name="TensorRT",
        description=package_description,
        dependencies=[
            Dependency(
                display_name="TensorRT",
                pypi_name="tensorrt",
                version="10.0.1",
                size_estimate=int(1.2 * GB),
                auto_update=False,
            ),
            Dependency(
                display_name="CUDA Python",
                pypi_name="cuda-python",
                version="12.3.0",
                size_estimate=20 * MB,
            ),
        ],
        icon="Nvidia",
        color="#76B900",
    )

    tensorrt_category = package.add_category(
        name="TensorRT",
        description="Nodes for using NVIDIA TensorRT for optimized GPU inference.",
        icon="Nvidia",
        color="#76B900",
        install_hint=install_hint,
    )

    logger.debug("Loaded package %s", package.name)
else:
    # Create a dummy for imports to not fail
    package = None  # type: ignore
    tensorrt_category = None  # type: ignore
    if is_arm_mac:
        logger.debug("TensorRT package not available on ARM Mac")
    else:
        logger.debug("TensorRT package not available (no NVIDIA GPU detected)")
