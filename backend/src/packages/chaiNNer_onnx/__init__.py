from sanic.log import logger

from api import KB, MB, Dependency, add_package
from gpu import nvidia_is_available
from system import is_arm_mac

general = "ONNX 使用 .onnx 模型来放大图像。"
conversion = "它还帮助在 PyTorch 和 NCNN 之间进行转换。"

if is_arm_mac:
    package_description = f"{general} {conversion} 但它不支持 CoreML。"
    inst_hint = general
else:
    package_description = (
        f"{general} {conversion} 当 CUDA 可用时速度最快。如果系统上安装了 TensorRT，则还可以配置为使用它。"
    )
    inst_hint = f"{general} 它不支持 AMD GPU。"


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
    description=package_description,
    dependencies=[
        Dependency(
            display_name="ONNX",
            pypi_name="onnx",
            version="1.14.1",
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
    description="使用 ONNX 神经网络框架处理图像的节点。",
    icon="ONNX",
    color="#63B3ED",
    install_hint=inst_hint,
)


logger.debug(f"加载包 {package.name}")
