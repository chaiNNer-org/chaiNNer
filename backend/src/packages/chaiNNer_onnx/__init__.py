from sanic.log import logger

from api import KB, MB, Dependency, add_package, is_arm_mac
from gpu import nvidia_is_available


def get_onnx_runtime():
    if is_arm_mac:
        return Dependency(
            display_name="ONNX Runtime (Silicon)",
            package_name="onnxruntime-silicon",
            version="1.13.1",
            size_estimate=6 * MB,
            import_name="onnxruntime",
        )
    elif nvidia_is_available:
        return Dependency(
            display_name="ONNX Runtime (GPU)",
            package_name="onnxruntime-gpu",
            version="1.13.1",
            size_estimate=110 * MB,
            import_name="onnxruntime",
        )
    else:
        return Dependency(
            display_name="ONNX Runtime",
            package_name="onnxruntime",
            version="1.13.1",
            size_estimate=5 * MB,
        )


dependencies = [
    Dependency(
        display_name="ONNX",
        package_name="onnx",
        version="1.13.0",
        size_estimate=12 * MB,
    ),
]

if not is_arm_mac:
    dependencies.append(
        Dependency(
            display_name="ONNX Optimizer",
            package_name="onnxoptimizer",
            version="0.3.6",
            size_estimate=300 * KB,
        )
    )

dependencies.extend(
    [
        get_onnx_runtime(),
        Dependency(
            display_name="Protobuf",
            package_name="protobuf",
            version="3.20.2",
            size_estimate=500 * KB,
        ),
        Dependency(
            display_name="SciPy",
            package_name="scipy",
            version="1.9.3",
            size_estimate=42 * MB,
        ),
        Dependency(
            display_name="Numba",
            package_name="numba",
            version="0.56.3",
            size_estimate=2.5 * MB,
        ),
    ]
)


package = add_package(
    __file__,
    name="ONNX",
    description="ONNX uses .onnx models to upscale images. It also helps to convert between PyTorch and NCNN. It is fastest when CUDA is supported. If TensorRT is installed on the system, it can also be configured to use that.",
    dependencies=dependencies,
)

onnx_category = package.add_category(
    name="ONNX",
    description="Nodes for using the ONNX Neural Network Framework with images.",
    icon="ONNX",
    color="#63B3ED",
    install_hint="ONNX uses .onnx models to upscale images. It does not support AMD GPUs.",
)


logger.debug(f"Loaded package {package.name}")
