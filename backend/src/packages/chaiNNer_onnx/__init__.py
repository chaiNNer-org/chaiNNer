from sanic.log import logger

from api import KB, MB, Dependency, add_package
from gpu import nvidia_is_available


def get_onnx_runtime():
    if nvidia_is_available:
        return Dependency(
            display_name="ONNX Runtime (GPU)",
            pypi_name="onnxruntime-gpu",
            version="1.15.1",
            size_estimate=120 * MB,
            import_name="onnxruntime",
        )
    else:
        return Dependency(
            display_name="ONNX Runtime",
            pypi_name="onnxruntime",
            version="1.15.1",
            size_estimate=6 * MB,
        )


package = add_package(
    __file__,
    id="chaiNNer_onnx",
    name="ONNX",
    description="ONNX uses .onnx models to upscale images. It also helps to convert between PyTorch and NCNN. It is fastest when CUDA is supported. If TensorRT is installed on the system, it can also be configured to use that.",
    dependencies=[
        Dependency(
            display_name="ONNX",
            pypi_name="onnx",
            version="1.14.0",
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
            version="3.20.2",
            size_estimate=500 * KB,
        ),
        Dependency(
            display_name="Numba",
            pypi_name="numba",
            version="0.56.3",
            size_estimate=2.5 * MB,
        ),
        Dependency(
            display_name="re2",
            pypi_name="google-re2",
            version="1.0",
            size_estimate=275 * KB,
            import_name="re2",
        ),
    ],
)

onnx_category = package.add_category(
    name="ONNX",
    description="Nodes for using the ONNX Neural Network Framework with images.",
    icon="ONNX",
    color="#63B3ED",
    install_hint="ONNX uses .onnx models to upscale images. It does not support AMD GPUs.",
)


logger.debug(f"Loaded package {package.name}")
