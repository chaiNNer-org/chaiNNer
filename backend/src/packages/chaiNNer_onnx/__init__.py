from logger import get_logger_from_env

logger = get_logger_from_env()

from api import KB, MB, Dependency, add_package
from gpu import nvidia
from system import is_arm_mac, is_windows

general = "ONNX uses .onnx models to upscale images."
conversion = "It also helps to convert between PyTorch and NCNN."

if is_arm_mac:
    package_description = f"{general} {conversion} However, it does not support CoreML."
    inst_hint = general
else:
    package_description = (
        f"{general} {conversion} It is fastest when CUDA is supported. If TensorRT is"
        " installed on the system, it can also be configured to use that."
    )
    inst_hint = f"{general} It does not support AMD GPUs, in linux."


def get_onnx_runtime():
    if nvidia.is_available:
        return Dependency(
            display_name="ONNX Runtime (GPU)",
            pypi_name="onnxruntime-gpu",
            version="1.17.1",
            size_estimate=120 * MB,
            import_name="onnxruntime",
            extra_index_url="https://aiinfra.pkgs.visualstudio.com/PublicPackages/_packaging/onnxruntime-cuda-12/pypi/simple/",
        )
    elif is_windows:
        return Dependency(
            display_name="ONNX Runtime (DirectMl)",
            pypi_name="onnxruntime-directml",
            version="1.17.1",
            size_estimate=15 * MB,
        )
    else:
        return Dependency(
            display_name="ONNX Runtime",
            pypi_name="onnxruntime",
            version="1.17.1",
            size_estimate=6 * MB,
        )


package = add_package(
    __file__,
    id="chaiNNer_onnx",
    name="ONNX",
    description=package_description,
    dependencies=[
        Dependency(
            display_name="ONNX",
            pypi_name="onnx",
            version="1.16.0",
            size_estimate=12 * MB,
        ),
        Dependency(
            display_name="ONNX Optimizer",
            pypi_name="onnxoptimizer",
            version="0.3.13",
            size_estimate=300 * KB,
        ),
        get_onnx_runtime(),
        Dependency(
            display_name="Protobuf",
            pypi_name="protobuf",
            version="4.24.2",
            size_estimate=500 * KB,
        ),
    ],
    icon="ONNX",
    color="#63B3ED",
)


onnx_category = package.add_category(
    name="ONNX",
    description="Nodes for using the ONNX Neural Network Framework with images.",
    icon="ONNX",
    color="#63B3ED",
    install_hint=inst_hint,
)


logger.debug(f"Loaded package {package.name}")
