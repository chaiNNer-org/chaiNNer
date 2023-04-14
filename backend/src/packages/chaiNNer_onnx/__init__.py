from sanic.log import logger

from api import add_package

package = add_package(__file__, name="chaiNNer_onnx", dependencies=[])

onnx_category = package.add_category(
    name="ONNX",
    description="Nodes for using the ONNX Neural Network Framework with images.",
    icon="ONNX",
    color="#63B3ED",
    install_hint="ONNX uses .onnx models to upscale images. It does not support AMD GPUs.",
)


logger.debug(f"Loaded package {package.name}")
