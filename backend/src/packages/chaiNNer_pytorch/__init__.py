from sanic.log import logger

from api import add_package

package = add_package(__file__, name="chaiNNer_pytorch", dependencies=[])

pytorch_category = package.add_category(
    name="PyTorch",
    description="Nodes for using the PyTorch Neural Network Framework with images.",
    icon="PyTorch",
    color="#DD6B20",
    install_hint="PyTorch uses .pth models to upscale images. It is the most widely-used upscaling architecture. However, it does not support AMD GPUs.",
)

logger.debug(f"Loaded package {package.name}")
